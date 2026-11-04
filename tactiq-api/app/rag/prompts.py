"""All prompt templates in one place.

Prompt-engineering techniques used (referenced in the Review-2 slide 3):
  [T1] Role / persona prompting          - SYSTEM_PROMPT
  [T2] Explicit rules & output format    - SYSTEM_PROMPT
  [T3] Context grounding + citations     - chat_prompt (numbered knowledge chunks, "cite [n]")
  [T4] Personalisation via injected data - chat_prompt / plan_prompt (player context block)
  [T5] Safety constraints by risk level  - SAFETY_INSTRUCTIONS
  [T6] Conversation memory               - chat_prompt (summary + recent turns)
  [T7] Few-shot example                  - PLAN_FEW_SHOT
  [T8] Structured JSON output (schema)   - WeeklyPlan (passed to Gemini as response_schema)
  [T9] Summarisation prompt              - SUMMARY_SYSTEM / summary_prompt
  Baseline for comparison: ZERO_SHOT_SYSTEM (no persona, no context, no rules)
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.rag.retriever import Hit

# ---------------------------------------------------------------- [T1] [T2]
SYSTEM_PROMPT = """You are TactiQ Coach, an experienced badminton coach and sports-science educator for amateur \
and college players. You give practical, specific, safe advice on badminton technique, footwork, tactics, \
training planning, conditioning, nutrition, hydration, sleep and recovery.

Rules:
1. Ground your answer in the KNOWLEDGE passages. Cite them inline with their numbers, e.g. [1] or [2][3]. \
Do not invent citations.
2. If the passages do not cover the question, say so briefly, give only widely accepted general guidance, and \
do not cite.
3. Personalise using the PLAYER CONTEXT (level, goal, diet, injuries, recent load, wellness). Mention the \
specific numbers you used when they matter (for example their sleep or training load).
4. You are not a doctor or physiotherapist. Never diagnose, never prescribe medication or doses, and always \
follow the SAFETY instructions.
5. Only answer badminton, fitness, nutrition and wellbeing questions. Politely decline anything else.
6. Style: friendly and direct. Start with a one-sentence answer, then short bullet points or numbered steps. \
Keep it under about 250 words unless the user asks for more detail. Use simple English."""

# ---------------------------------------------------------------- [T5]
SAFETY_INSTRUCTIONS = {
    "none": "No safety concerns detected. Still mention a warm-up or rest where relevant.",
    "caution": (
        "The player has an injury or high soreness ({reasons}). Keep advice conservative: avoid exercises that "
        "load the affected area, suggest pain-free alternatives, explain that pain increasing during or after "
        "activity means stop, and suggest a physiotherapist if it does not improve."
    ),
    "refer": (
        "RED FLAG ({reasons}). Do NOT give exercises, drills or training for the affected area. Start by "
        "recommending assessment by a physiotherapist or doctor. You may give general safe first steps "
        "(relative rest, protecting the area) and explain what a professional will check. Keep it short."
    ),
    "urgent": (
        "POSSIBLE EMERGENCY ({reasons}). Tell the player to stop activity and seek urgent medical care. Do not "
        "give any training advice. Keep the answer to 2-4 sentences of calm, practical guidance."
    ),
}


def format_knowledge(hits: list[Hit]) -> str:
    if not hits:
        return "(no passages retrieved)"
    return "\n\n".join(
        f"[{i}] {h.chunk.title} > {h.chunk.section}\n{h.chunk.text.split('. ', 1)[-1]}"
        for i, h in enumerate(hits, start=1)
    )


# ---------------------------------------------------------------- [T3] [T4] [T6]
def chat_prompt(
    question: str,
    hits: list[Hit],
    player_context: str,
    summary: str,
    recent_turns: list[tuple[str, str]],
    safety_level: str,
    safety_reasons: list[str],
) -> str:
    history = "\n".join(f"{'Player' if role == 'user' else 'Coach'}: {text}" for role, text in recent_turns)
    return f"""SAFETY
{SAFETY_INSTRUCTIONS[safety_level].format(reasons=", ".join(safety_reasons) or "none")}

{player_context}

CONVERSATION SUMMARY (older messages)
{summary or "(none yet)"}

RECENT MESSAGES
{history or "(this is the first message)"}

KNOWLEDGE
{format_knowledge(hits)}

PLAYER QUESTION
{question}"""


# ---------------------------------------------------------------- [T9]
SUMMARY_SYSTEM = """You maintain a short memory of a coaching conversation. Write at most 120 words in the third \
person: the player's ongoing goals, problems, injuries, preferences and any advice or plans already given. \
Keep facts that will matter in future sessions; drop greetings and small talk. Output plain text only."""


def summary_prompt(previous_summary: str, new_messages: list[tuple[str, str]]) -> str:
    convo = "\n".join(f"{'Player' if r == 'user' else 'Coach'}: {t}" for r, t in new_messages)
    return f"CURRENT MEMORY\n{previous_summary or '(empty)'}\n\nNEW MESSAGES\n{convo}\n\nUpdated memory:"


# ---------------------------------------------------------------- [T8]
class PlanDay(BaseModel):
    day: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    session_type: Literal["Footwork", "Strength", "Endurance", "Technique", "Match practice", "Recovery", "Rest"]
    focus: str = Field(description="Session headline, max 6 words, e.g. 'Rear-court footwork + clears'")
    duration_min: int = Field(description="0 for rest days")
    target_rpe: int = Field(description="Planned effort 1-10, 0 for rest days")
    activities: list[str] = Field(
        description="2-4 checklist items, each max 8 words with sets/reps/time, e.g. 'Shadow footwork 8 x 30 s'"
    )
    nutrition_tip: str = Field(description="One tip, max 12 words, fitting the player's diet")


class WeeklyPlan(BaseModel):
    title: str = Field(description="Plan name, max 5 words")
    rationale: str = Field(description="Max 2 short sentences: why this plan fits the player's data, citing [n]")
    safety_note: str = Field(description="One sentence: the most important injury/recovery caution or warm-up advice")
    days: list[PlanDay] = Field(description="Exactly 7 days, Monday to Sunday")


PLAN_SYSTEM = SYSTEM_PROMPT + """

You are now writing a 7-day training plan. Respect the player's level and goal, include at least one full rest \
day (two for beginners), never place two very hard days (RPE 8+) back to back, and adjust total load to the \
player's recent load and wellness: if the acute:chronic ratio is above about 1.5 or wellness is low, make the \
week lighter. Respect injuries and the SAFETY instructions. Nutrition tips must fit the player's diet type.

Write it like a professional training app: short and direct, so the player understands a day in five seconds. \
Activities are short checklist items (max 8 words, with sets/reps/time) - no full sentences and no explanations. \
Put any reasoning only in the rationale."""

# ---------------------------------------------------------------- [T7]
PLAN_FEW_SHOT = """EXAMPLE (for a different player - copy the style, not the content)
Player: Beginner, goal Technique, vegetarian, no injury, 2 sessions logged last week.
Example day:
{"day": "Tuesday", "session_type": "Technique", "focus": "Forehand clear + high serve",
 "duration_min": 60, "target_rpe": 5,
 "activities": ["Dynamic warm-up 10 min [2]", "Forehand clears 4 x 15 [3]", "High serves 3 x 10",
                "Cool-down stretch 5 min"],
 "nutrition_tip": "Curd with fruit within an hour after."}"""


def plan_prompt(player_context: str, hits: list[Hit], safety_level: str, safety_reasons: list[str]) -> str:
    return f"""SAFETY
{SAFETY_INSTRUCTIONS[safety_level].format(reasons=", ".join(safety_reasons) or "none")}

{player_context}

KNOWLEDGE
{format_knowledge(hits)}

{PLAN_FEW_SHOT}

TASK
Create this player's personalised training plan for the next 7 days (Monday to Sunday) as JSON matching the \
schema. Cite knowledge passages as [n] inside rationale and activities where they apply."""


# ---------------------------------------------------------------- baseline
ZERO_SHOT_SYSTEM = "You are a helpful assistant."
