"""Zero-shot prompt vs TactiQ's engineered RAG prompt on the five core use cases.

Usage:  python -m scripts.seed_demo   (once, creates the demo player)
        python -m eval.prompt_compare
Needs GEMINI_API_KEY. Makes 10 Gemini calls, paced for the free tier.
Writes eval/output/prompt_comparison.md (side-by-side answers + simple automatic checks).
"""

import re
import time
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.rag import llm, prompts, safety
from app.rag.player_context import build_player_context, todays_checkin
from app.rag.retriever import get_retriever
from scripts.seed_demo import DEMO_EMAIL

OUT = Path(__file__).parent / "output"
PAUSE_SECONDS = 7  # stay under free-tier requests-per-minute limits

# (objective, question, words that show the answer used this player's data)
USE_CASES = [
    ("Technique / footwork coaching", "How can I get to the rear court faster?",
     ["intermediate", "footwork", "knee"]),
    ("Nutrition guidance", "What should I eat on a tournament day?",
     ["vegetarian", "paneer", "dal", "curd", "tofu", "68"]),
    ("Personalised training load", "I want to train harder this week. How much more should I do?",
     ["acwr", "ratio", "1.4", "load", "soreness", "sleep", "exam"]),
    ("Injury-aware advice", "Can I do jump smashes? My knee is a bit sore.",
     ["knee", "physio", "pain", "recovering"]),
    ("Safety referral", "I heard a pop in my ankle and it is swelling fast.",
     ["doctor", "medical", "physio", "emergency", "stop"]),
]


def checks(answer: str, personal_terms: list[str]) -> dict:
    low = answer.lower()
    return {
        "words": len(answer.split()),
        "citations": len(set(re.findall(r"\[(\d+)\]", answer))),
        "personalised": sum(t in low for t in personal_terms),
        "refers_to_professional": any(w in low for w in ("physio", "doctor", "medical")),
    }


def main():
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user is None:
            raise SystemExit("Run `python -m scripts.seed_demo` first.")
        context = build_player_context(db, user)
        checkin = todays_checkin(db, user)
        profile = user.profile

        sections, table = [], []
        for objective, question, terms in USE_CASES:
            zero = llm.generate(prompts.ZERO_SHOT_SYSTEM, question, temperature=0.3)
            time.sleep(PAUSE_SECONDS)

            risk = safety.assess(question, profile, checkin)
            hits = get_retriever().search(question)
            prompt = prompts.chat_prompt(question, hits, context, "", [], risk.level, risk.reasons)
            rag = llm.generate(prompts.SYSTEM_PROMPT, prompt, temperature=0.3)
            notice = safety.notice_for(risk)
            if notice:
                rag = f"{notice}\n\n{rag}"
            time.sleep(PAUSE_SECONDS)

            cz, cr = checks(zero, terms), checks(rag, terms)
            table.append((objective, cz, cr, risk.level))
            sources = "\n".join(f"  [{i}] {h.chunk.title} > {h.chunk.section}" for i, h in enumerate(hits, 1))
            sections.append(
                f"## {objective}\n\n**Question:** {question}  \n**Safety level:** {risk.level}\n\n"
                f"### A. Zero-shot (\"You are a helpful assistant\", question only)\n\n{zero}\n\n"
                f"### B. TactiQ engineered RAG prompt\n\n{rag}\n\nRetrieved passages:\n```\n{sources}\n```\n"
            )
            print(f"done: {objective}")

    md = [
        "# Prompt engineering comparison - demo player (Intermediate, vegetarian, recovering right knee, load spike)",
        "",
        "| Use case | Words (A / B) | Citations (A / B) | Player-specific details (A / B) | Refers to professional (A / B) |",
        "|---|---|---|---|---|",
        *[
            f"| {o} | {a['words']} / {b['words']} | {a['citations']} / {b['citations']} | "
            f"{a['personalised']} / {b['personalised']} | {'yes' if a['refers_to_professional'] else 'no'} / "
            f"{'yes' if b['refers_to_professional'] else 'no'} |"
            for o, a, b, _ in table
        ],
        "",
        "Player-specific details = how many of the demo player's own facts (diet, injury, load, sleep...) the answer used.",
        "",
        *sections,
    ]
    OUT.mkdir(exist_ok=True)
    (OUT / "prompt_comparison.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md[:9]))
    print(f"\nFull side-by-side answers: {OUT / 'prompt_comparison.md'}")


if __name__ == "__main__":
    main()
