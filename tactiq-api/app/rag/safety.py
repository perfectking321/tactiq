"""Rule-based input safety guardrail.

Runs BEFORE retrieval/generation and is deterministic, so a red flag is never missed because of
LLM randomness. It combines the user's message with stored context (profile injury + today's check-in).

Levels:
  none    - normal coaching
  caution - known injury / high soreness: advice must be injury-aware and conservative
  refer   - recommend seeing a physiotherapist/doctor before training; no exercise prescription for the injured area
  urgent  - possible emergency: stop activity and seek urgent medical care
"""

import re
from dataclasses import dataclass, field

URGENT_PATTERNS = {
    r"\bchest (pain|pressure|tightness)\b|\bpain in (my )?chest\b": "chest pain",
    r"\b(faint(ed|ing)?|passed out|blacked out|collapsed?)\b": "fainting or collapse",
    r"\b(can'?t|cannot|unable to|struggling to) breathe\b|\bshort(ness)? of breath\b": "breathing difficulty",
    r"\b(heart (racing|pounding|irregular)|palpitations?)\b": "abnormal heartbeat",
    r"\b(concussion|hit (my|on the) head|head injury|blow to the head)\b": "possible head injury",
    r"\b(numb(ness)?|tingling|pins and needles)\b": "numbness or tingling",
    r"\b(deformed|deformity|bone (is )?sticking out|looks? (bent|out of place)|dislocat\w*)\b": "possible fracture/dislocation",
    r"\b(can'?t|cannot|unable to) (put|bear|take) (any )?weight\b|\bcan'?t walk\b": "unable to bear weight",
    r"\b(heard|felt) (a )?(pop|snap)\b|\b(popped|snapped)\b": "pop or snap at injury",
    r"\bkicked (me )?in the (back of )?(my |the )?(heel|ankle|calf|achilles)\b": "possible Achilles rupture",
    r"\b(bladder|bowel)\b": "bladder/bowel symptoms",
}

REFER_PATTERNS = {
    r"\b(severe|unbearable|excruciating|extreme|sharp|stabbing) pain\b|\bpain (is )?(severe|unbearable)\b": "severe or sharp pain",
    r"\b(swollen|swelling)\b": "swelling",
    r"\b(locks?|locking|gives? way|giving way|unstable)\b": "joint locking or instability",
    r"\b(wakes? me|keeps me awake|at night)\b.*\bpain\b|\bpain\b.*\b(wakes? me|at night)\b": "night pain",
    r"\bpain\b.*\b(for|since) (\d+|a few|several|two|three) (weeks|months)\b": "persistent pain",
    r"\b(limp|limping)\b": "limping",
    r"\b(painkillers?|ibuprofen|paracetamol|diclofenac|dosage|dose of|steroids?|injection)\b": "medication question",
    r"\b(fractured?|broken|broke my|torn|tore|tear|ruptured?|ligament|acl|meniscus)\b": "suspected structural injury",
}

PAIN_SCORE = re.compile(r"\bpain\D{0,20}?(\d{1,2})\s*(?:/|out of)\s*10\b|\b(\d{1,2})\s*(?:/|out of)\s*10\b\D{0,20}pain")

RANK = {"none": 0, "caution": 1, "refer": 2, "urgent": 3}


@dataclass
class SafetyResult:
    level: str = "none"
    reasons: list[str] = field(default_factory=list)

    @property
    def flag(self) -> bool:
        return RANK[self.level] >= RANK["refer"]

    def raise_to(self, level: str, reason: str):
        if RANK[level] > RANK[self.level]:
            self.level = level
        if reason not in self.reasons:
            self.reasons.append(reason)


def assess(message: str, profile=None, todays_checkin=None) -> SafetyResult:
    text = message.lower()
    result = SafetyResult()

    for pattern, reason in URGENT_PATTERNS.items():
        if re.search(pattern, text):
            result.raise_to("urgent", reason)
    for pattern, reason in REFER_PATTERNS.items():
        if re.search(pattern, text):
            result.raise_to("refer", reason)

    for m in PAIN_SCORE.finditer(text):
        score = int(m.group(1) or m.group(2))
        if score >= 7:
            result.raise_to("refer", f"reported pain {score}/10")
        elif score >= 4:
            result.raise_to("caution", f"reported pain {score}/10")

    # For an urgent message, only mention the profile injury if the message refers to the same body part.
    profile_relevant = result.level != "urgent" or (
        profile is not None and bool(profile.injury_body_part) and profile.injury_body_part.lower() in text
    )
    if profile is not None and profile.injury_status != "None" and profile_relevant:
        where = profile.injury_body_part or "unspecified area"
        if profile.injury_status == "Current" and profile.pain_level >= 7:
            result.raise_to("refer", f"profile: current {where} injury, pain {profile.pain_level}/10")
        else:
            result.raise_to("caution", f"profile: {profile.injury_status.lower()} {where} injury")

    if todays_checkin is not None and todays_checkin.soreness >= 8:
        result.raise_to("caution", f"today's soreness {todays_checkin.soreness}/10")

    return result


URGENT_NOTICE = (
    "**Please stop training now.** What you describe ({reasons}) can be a sign of a serious problem. "
    "Seek medical help promptly - contact a doctor, go to an emergency department, or call your local "
    "emergency number (112 in India) if symptoms are severe or getting worse. "
    "TactiQ cannot assess injuries or medical conditions."
)

REFER_NOTICE = (
    "**Recommendation: get this checked by a physiotherapist or doctor before training on it.** "
    "Reason: {reasons}. The information below is general and is not a diagnosis."
)


def notice_for(result: SafetyResult) -> str | None:
    reasons = ", ".join(result.reasons)
    if result.level == "urgent":
        return URGENT_NOTICE.format(reasons=reasons)
    if result.level == "refer":
        return REFER_NOTICE.format(reasons=reasons)
    return None
