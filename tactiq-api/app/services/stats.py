"""Progress analytics computed from the player's manual logs.

Shared by the dashboard (/stats/summary) and the AI player-context builder,
so the coach and the charts always see the same numbers.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Checkin, Match, TrainingSession, User
from app.schemas import match_result, parse_game_scores


def wellness_score(c: Checkin) -> int:
    """0-100 self-reported wellness: sleep, energy, low soreness and low stress weighted equally."""
    sleep = min(c.sleep_hours / 8, 1) * 10
    parts = [sleep, c.energy, 11 - c.soreness, 11 - c.stress]
    return round(sum(parts) / len(parts) * 10)


def wellness_label(score: int) -> str:
    if score >= 75:
        return "Good to train"
    if score >= 55:
        return "Train with care"
    return "Prioritise recovery"


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def compute_summary(db: Session, user: User, today: date | None = None) -> dict:
    today = today or date.today()

    sessions = db.scalars(
        select(TrainingSession).where(TrainingSession.user_id == user.id).order_by(TrainingSession.date)
    ).all()
    matches = db.scalars(select(Match).where(Match.user_id == user.id).order_by(Match.date, Match.id)).all()
    checkins = db.scalars(select(Checkin).where(Checkin.user_id == user.id).order_by(Checkin.date)).all()

    # ---- matches ----
    match_rows = []
    for m in matches:
        games = parse_game_scores(m.game_scores)
        match_rows.append({
            "date": m.date.isoformat(),
            "opponent": m.opponent,
            "format": m.format,
            "result": match_result(games),
            "score": m.game_scores.replace(",", ", "),
            "points_won": sum(a for a, _ in games),
            "points_lost": sum(b for _, b in games),
            "self_rating": m.self_rating,
        })
    wins = sum(1 for r in match_rows if r["result"] == "Win")
    losses = sum(1 for r in match_rows if r["result"] == "Loss")

    # ---- training load (session-RPE = minutes x RPE) ----
    def load_between(start: date, end: date) -> int:
        return sum(s.duration_min * s.rpe for s in sessions if start <= s.date <= end)

    acute = load_between(today - timedelta(days=6), today)
    chronic_weekly = load_between(today - timedelta(days=27), today) / 4
    # Acute:chronic workload ratio; only meaningful with some history.
    has_history = any(s.date <= today - timedelta(days=21) for s in sessions)
    acwr = round(acute / chronic_weekly, 2) if has_history and chronic_weekly > 0 else None

    this_week = _week_start(today)
    weekly = []
    for i in range(7, -1, -1):
        start = this_week - timedelta(weeks=i)
        end = start + timedelta(days=6)
        in_week = [s for s in sessions if start <= s.date <= end]
        weekly.append({
            "week": start.isoformat(),
            "minutes": sum(s.duration_min for s in in_week),
            "load": sum(s.duration_min * s.rpe for s in in_week),
            "sessions": len(in_week),
        })

    by_type: dict[str, int] = {}
    for s in sessions:
        if s.date >= today - timedelta(days=27):
            by_type[s.type] = by_type.get(s.type, 0) + s.duration_min

    # ---- wellness ----
    wellness = [
        {
            "date": c.date.isoformat(),
            "sleep_hours": c.sleep_hours,
            "energy": c.energy,
            "soreness": c.soreness,
            "stress": c.stress,
            "water_l": c.water_l,
            "score": wellness_score(c),
        }
        for c in checkins
        if c.date >= today - timedelta(days=29)
    ]
    latest = checkins[-1] if checkins else None
    latest_out = None
    if latest:
        score = wellness_score(latest)
        latest_out = {
            "date": latest.date.isoformat(),
            "is_today": latest.date == today,
            "score": score,
            "label": wellness_label(score),
            "sleep_hours": latest.sleep_hours,
            "energy": latest.energy,
            "soreness": latest.soreness,
            "stress": latest.stress,
            "water_l": latest.water_l,
        }

    ratings = [m.self_rating for m in matches]
    return {
        "kpis": {
            "matches_played": len(matches),
            "wins": wins,
            "losses": losses,
            "win_rate": round(wins / len(matches) * 100, 1) if matches else None,
            "avg_match_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
            "training_sessions": len(sessions),
            "training_hours": round(sum(s.duration_min for s in sessions) / 60, 1),
            "load_last_7_days": acute,
            "acwr": acwr,
        },
        "latest_checkin": latest_out,
        "weekly_training": weekly,
        "training_by_type_28d": [{"type": k, "minutes": v} for k, v in sorted(by_type.items())],
        "wellness_trend": wellness,
        "recent_matches": match_rows[-10:],
    }

