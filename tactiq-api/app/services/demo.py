"""Demo profile: a sample player with six weeks of realistic logs ending today.

Used by the login screen's "Demo player" card (POST /auth/demo) and the "Reset demo data" button
(POST /auth/demo/reset). Resetting keeps the same user row, so an open session stays valid.
"""

import random
import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    ChatMessage, Checkin, ConversationSummary, Match, Profile, TrainingPlan, TrainingSession, User,
)
from app.security import hash_password

DEMO_EMAIL = "demo@example.com"
DEMO_NAME = "Aarav Mehta"

OPPONENTS = ["Rohan", "Kabir", "Ishaan", "Vihaan", "Aditya", "Neel"]
WEEK_PATTERN = [  # (weekday, type, minutes, rpe)
    (0, "Footwork", 60, 6),
    (2, "Technique", 75, 5),
    (3, "Strength", 45, 6),
    (5, "Match practice", 90, 7),
]
MATCH_SCORES = ["21-17,21-19", "18-21,21-16,21-18", "15-21,17-21", "21-12,21-15", "21-19,19-21,18-21",
                "21-18,21-23,19-21", "21-14,16-21,21-19", "19-21,21-17,21-15"]

# A ready-made week so "Today's plan" works offline; a live AI plan can be generated from the Plan page.
DEMO_PLAN = {
    "title": "Recovery-aware footwork week",
    "rationale": "Your load spiked this week (ratio about 1.4) and wellness dropped, so this week is lighter [1]. "
                 "Footwork stays low-impact while the right knee recovers.",
    "safety_note": "Keep lunges short; stop if knee pain goes above 3/10.",
    "days": [
        {"day": "Monday", "session_type": "Recovery", "focus": "Mobility and easy cycling", "duration_min": 30,
         "target_rpe": 2, "activities": ["Easy cycling 15 min", "Hip + ankle mobility 10 min",
                                         "Calf + quad stretches"],
         "nutrition_tip": "Dal-rice with curd to refuel after a heavy week."},
        {"day": "Tuesday", "session_type": "Footwork", "focus": "Low-impact shadow footwork", "duration_min": 45,
         "target_rpe": 4, "activities": ["Dynamic warm-up 10 min", "Shadow footwork 8 x 30 s, half pace",
                                         "Split-step drill 5 x 1 min"],
         "nutrition_tip": "Banana and a glass of milk an hour before."},
        {"day": "Wednesday", "session_type": "Rest", "focus": "Full rest and sleep focus", "duration_min": 0,
         "target_rpe": 0, "activities": ["Complete physical rest", "Aim for 8 hours of sleep"],
         "nutrition_tip": "Keep protein steady: paneer or tofu with dinner."},
        {"day": "Thursday", "session_type": "Technique", "focus": "Rear-court footwork + clears", "duration_min": 60,
         "target_rpe": 5, "activities": ["Dynamic warm-up 10 min", "Forehand clears 4 x 15",
                                         "Rear-court recovery steps 6 x 30 s"],
         "nutrition_tip": "Roti with chana and vegetables at lunch."},
        {"day": "Friday", "session_type": "Strength", "focus": "Knee-friendly lower-body strength",
         "duration_min": 40, "target_rpe": 5,
         "activities": ["Goblet squat 3 x 10, pain-free", "Hamstring bridges 3 x 12",
                        "Calf raises 3 x 15"],
         "nutrition_tip": "Lassi or soy milk smoothie after the session."},
        {"day": "Saturday", "session_type": "Match practice", "focus": "Controlled half-court games",
         "duration_min": 60, "target_rpe": 6,
         "activities": ["Warm-up rallies 15 min", "Half-court games to 15", "Cool-down stretch 5 min"],
         "nutrition_tip": "Carry dates and water for between games."},
        {"day": "Sunday", "session_type": "Rest", "focus": "Rest and review the week", "duration_min": 0,
         "target_rpe": 0, "activities": ["Rest", "Log a daily check-in"],
         "nutrition_tip": "Hydrate well: 2.5-3 litres through the day."},
    ],
}
DEMO_PLAN_SOURCES = [{"ref": 1, "title": "Planning a training week and monitoring load",
                      "section": "Progressing load safely", "doc_id": "training-planning"}]


def get_or_create_demo_user(db: Session) -> tuple[User, bool]:
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user:
        return user, False
    # Random password: the demo account is opened only through the demo endpoint.
    user = User(email=DEMO_EMAIL, password_hash=hash_password(secrets.token_urlsafe(24)))
    db.add(user)
    db.flush()
    return user, True


def reset_demo_data(db: Session, user: User, today: date | None = None) -> None:
    """Replace all of the demo user's data with six fresh weeks ending `today`."""
    today = today or date.today()
    rnd = random.Random(42)

    for model in (TrainingSession, Match, Checkin, ChatMessage, TrainingPlan):
        db.execute(delete(model).where(model.user_id == user.id))
    # One-per-user rows may already be loaded in the session, so delete them through the ORM.
    for obj in (db.get(Profile, user.id), db.get(ConversationSummary, user.id)):
        if obj is not None:
            db.delete(obj)
    db.flush()
    db.expire(user)

    db.add(Profile(
        user_id=user.id, name=DEMO_NAME, age=21, gender="Male", height_cm=175, weight_kg=68,
        playing_level="Intermediate", main_goal="Footwork", injury_status="Recovering",
        injury_body_part="Right knee", pain_level=3, diet_type="Vegetarian",
    ))

    # Six weeks of training; the last days add hard sessions (a load spike for the AI to notice).
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=5)
    for week in range(6):
        for weekday, kind, minutes, rpe in WEEK_PATTERN:
            d = start + timedelta(weeks=week, days=weekday)
            if d > today:
                continue
            db.add(TrainingSession(
                user_id=user.id, date=d, type=kind,
                duration_min=minutes + rnd.choice([-10, 0, 0, 15]),
                rpe=min(10, rpe + rnd.choice([-1, 0, 0, 1]) + (1 if week == 5 else 0)),
                notes="",
            ))
    for offset, kind, minutes, rpe, note in [
        (1, "Endurance", 50, 8, "Multi-shuttle intervals, legs heavy"),
        (2, "Footwork", 70, 8, "Rear-court footwork, knee a bit sore after"),
    ]:
        db.add(TrainingSession(user_id=user.id, date=today - timedelta(days=offset), type=kind,
                               duration_min=minutes, rpe=rpe, notes=note))

    for i, s in enumerate(MATCH_SCORES):
        db.add(Match(
            user_id=user.id, date=today - timedelta(days=40 - i * 5), opponent=OPPONENTS[i % len(OPPONENTS)],
            format="Singles" if i % 3 else "Doubles", game_scores=s, self_rating=rnd.randint(5, 8),
            notes="Lost points on rear backhand" if s.count("-21") >= 2 else "",
        ))

    # Daily check-ins for the last 30 days; soreness creeps up and sleep drops in the last few days.
    for i in range(29, -1, -1):
        late = i <= 3
        db.add(Checkin(
            user_id=user.id, date=today - timedelta(days=i),
            sleep_hours=rnd.choice([6.0, 6.5]) if late else rnd.choice([7.0, 7.5, 8.0]),
            energy=rnd.randint(4, 6) if late else rnd.randint(6, 8),
            soreness=rnd.randint(6, 7) if late else rnd.randint(2, 4),
            stress=rnd.randint(5, 7) if late else rnd.randint(2, 4),
            water_l=rnd.choice([2.0, 2.5, 3.0]),
            notes="Exams this week" if late else "",
        ))

    db.add(TrainingPlan(user_id=user.id, plan=DEMO_PLAN, sources=DEMO_PLAN_SOURCES,
                        created_at=datetime.now(timezone.utc)))
    db.commit()


def ensure_demo(db: Session) -> User:
    """Demo user with data; creates and fills it on first use, otherwise keeps the user's changes."""
    user, created = get_or_create_demo_user(db)
    if created:
        reset_demo_data(db, user)
    return user
