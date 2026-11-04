"""TactiQ RAG pipeline - a fixed, linear sequence (not an agent).

    1. Safety guardrail (rules)      -> level: none / caution / refer / urgent
    2. Retrieval (MiniLM + Chroma)   -> top-k knowledge chunks
    3. Player context (SQL -> text)  -> profile + 14-day stats + wellness
    4. Memory                        -> rolling summary + last turns
    5. Prompt assembly               -> engineered prompt (app.rag.prompts)
    6. Generation (Gemini, 1 call)   -> answer / JSON plan, then post-processing + storage

The LLM never chooses actions or calls tools; every step always runs in this order.
"""

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings
from app.models import ChatMessage, TrainingPlan, User
from app.rag import llm, memory, prompts, safety
from app.rag.player_context import build_player_context, todays_checkin
from app.rag.retriever import Hit, get_retriever


@dataclass
class PipelineResult:
    answer: str
    sources: list[dict]
    safety_level: str
    safety_flag: bool


def retrieval_query(message: str, recent: list[ChatMessage]) -> str:
    """Short follow-ups ("what about doubles?") are expanded with the previous question."""
    previous = next((m.content for m in reversed(recent) if m.role == "user"), None)
    if previous and len(message.split()) < 8:
        return f"{previous} {message}"
    return message


def cited_sources(text: str, hits: list[Hit]) -> list[dict]:
    """Return only the passages the model actually cited, keeping the [n] numbering."""
    cited = {int(n) for n in re.findall(r"\[(\d+)\]", text)}
    return [
        {"ref": i, "title": h.chunk.title, "section": h.chunk.section, "doc_id": h.chunk.doc_id}
        for i, h in enumerate(hits, start=1)
        if i in cited
    ]


def answer_question(db: Session, user: User, message: str) -> PipelineResult:
    # 1. Safety
    risk = safety.assess(message, user.profile, todays_checkin(db, user))

    # 4. Memory (read before storing the new message)
    recent = memory.recent_messages(db, user)
    summary = memory.get_summary(db, user).summary

    # 2-3. Retrieval + player context
    hits = get_retriever().search(retrieval_query(message, recent), k=settings.top_k)
    player_context = build_player_context(db, user)

    # 5-6. Prompt + single generation call
    prompt = prompts.chat_prompt(
        question=message,
        hits=hits,
        player_context=player_context,
        summary=summary,
        recent_turns=[(m.role, m.content) for m in recent],
        safety_level=risk.level,
        safety_reasons=risk.reasons,
    )
    try:
        text = llm.generate(prompts.SYSTEM_PROMPT, prompt, temperature=0.3)
    except llm.LLMUnavailable:
        if risk.level != "urgent":
            raise
        text = ""  # the deterministic urgent notice below is still delivered without the LLM

    # Post-processing: the safety notice is added by code, so it can never be omitted by the model.
    notice = safety.notice_for(risk)
    answer = f"{notice}\n\n{text}".strip() if notice else text
    sources = cited_sources(text, hits)

    db.add(ChatMessage(user_id=user.id, role="user", content=message, sources=[], safety_flag=risk.flag))
    db.add(ChatMessage(user_id=user.id, role="assistant", content=answer, sources=sources, safety_flag=risk.flag))
    db.commit()
    memory.maybe_update_summary(db, user)

    return PipelineResult(answer=answer, sources=sources, safety_level=risk.level, safety_flag=risk.flag)


def plan_query(user: User) -> str:
    p = user.profile
    parts = [f"weekly training plan for a {p.playing_level.lower()} badminton player", f"goal {p.main_goal.lower()}"]
    if p.injury_status != "None":
        parts.append(f"{p.injury_body_part} injury return to play")
    parts.append(f"{p.diet_type.lower()} nutrition for training")
    return ", ".join(parts)


def generate_plan(db: Session, user: User) -> TrainingPlan:
    risk = safety.assess("", user.profile, todays_checkin(db, user))
    hits = get_retriever().search(plan_query(user), k=6)
    prompt = prompts.plan_prompt(build_player_context(db, user), hits, risk.level, risk.reasons)

    raw = llm.generate(prompts.PLAN_SYSTEM, prompt, temperature=0.4, schema=prompts.WeeklyPlan, max_output_tokens=4096)
    plan = prompts.WeeklyPlan.model_validate_json(raw)

    notice = safety.notice_for(risk)
    if notice:
        plan.safety_note = f"{notice} {plan.safety_note}"

    all_text = plan.rationale + " ".join(a for d in plan.days for a in d.activities)
    row = TrainingPlan(user_id=user.id, plan=plan.model_dump(), sources=cited_sources(all_text, hits))
    db.add(row)
    db.commit()
    return row
