"""Turn the player's profile and logged stats into a compact text block for the prompt.

This is the "personalisation" input of the RAG pipeline: the LLM sees the player's own numbers
(computed by app.services.stats) rather than raw database rows.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Checkin, TrainingSession, User
from app.services.stats import compute_summary


def build_player_context(db: Session, user: User, today: date | None = None) -> str:
    today = today or date.today()
    p = user.profile
    lines = ["PLAYER PROFILE"]
    if p is None:
        lines.append("- Profile not completed.")
    else:
        bmi = p.weight_kg / (p.height_cm / 100) ** 2
        lines += [
            f"- Name: {p.name}; age {p.age}; gender {p.gender}",
            f"- Height {p.height_cm:g} cm, weight {p.weight_kg:g} kg (BMI {bmi:.1f})",
            f"- Level: {p.playing_level}; main goal: {p.main_goal}; diet: {p.diet_type}",
        ]
        if p.injury_status == "None":
            lines.append("- Injury: none reported")
        else:
            lines.append(f"- Injury: {p.injury_status} - {p.injury_body_part}, pain {p.pain_level}/10")

    s = compute_summary(db, user, today)
    k = s["kpis"]

    since = today - timedelta(days=13)
    recent = db.scalars(
        select(TrainingSession)
        .where(TrainingSession.user_id == user.id, TrainingSession.date >= since)
        .order_by(TrainingSession.date)
    ).all()
    lines.append("\nLAST 14 DAYS TRAINING (session-RPE load = minutes x RPE)")
    if recent:
        by_type: dict[str, int] = {}
        for t in recent:
            by_type[t.type] = by_type.get(t.type, 0) + t.duration_min
        lines.append(
            f"- {len(recent)} sessions, {sum(t.duration_min for t in recent)} min total, "
            f"avg RPE {sum(t.rpe for t in recent) / len(recent):.1f}"
        )
        lines.append("- Minutes by type: " + ", ".join(f"{a} {b}" for a, b in sorted(by_type.items())))
    else:
        lines.append("- No training logged.")
    lines.append(f"- Load last 7 days: {k['load_last_7_days']}")
    if k["acwr"] is not None:
        lines.append(f"- Acute:chronic workload ratio: {k['acwr']} (above ~1.5 = load spike)")

    lines.append("\nMATCHES")
    if s["recent_matches"]:
        lines.append(f"- Overall: {k['wins']}W-{k['losses']}L, win rate {k['win_rate']}%, avg self-rating {k['avg_match_rating']}/10")
        for m in s["recent_matches"][-3:]:
            lines.append(f"- {m['date']} {m['format']} vs {m['opponent']}: {m['result']} ({m['score']}), self-rating {m['self_rating']}/10")
    else:
        lines.append("- No matches logged.")

    week_checkins = db.scalars(
        select(Checkin).where(Checkin.user_id == user.id, Checkin.date >= today - timedelta(days=6))
    ).all()
    lines.append("\nWELLNESS (self-reported 1-10)")
    latest = s["latest_checkin"]
    if latest:
        when = "today" if latest["is_today"] else f"on {latest['date']}"
        lines.append(
            f"- Latest check-in {when}: sleep {latest['sleep_hours']} h, energy {latest['energy']}, "
            f"soreness {latest['soreness']}, stress {latest['stress']}, water {latest['water_l']} L "
            f"-> wellness score {latest['score']}/100 ({latest['label']})"
        )
    if week_checkins:
        n = len(week_checkins)
        lines.append(
            f"- 7-day averages ({n} check-ins): sleep {sum(c.sleep_hours for c in week_checkins) / n:.1f} h, "
            f"soreness {sum(c.soreness for c in week_checkins) / n:.1f}, "
            f"energy {sum(c.energy for c in week_checkins) / n:.1f}"
        )
    if not latest:
        lines.append("- No check-ins logged.")

    return "\n".join(lines)


def todays_checkin(db: Session, user: User, today: date | None = None):
    today = today or date.today()
    return db.scalar(select(Checkin).where(Checkin.user_id == user.id, Checkin.date == today))
