"""Create (or reset) the demo profile with six weeks of data ending today.

Usage:  python -m scripts.seed_demo
The demo profile is opened from the login screen ("Demo player" card); it has no usable password.
"""

from app.db import Base, SessionLocal, engine
from app.services.demo import DEMO_EMAIL, get_or_create_demo_user, reset_demo_data


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user, _ = get_or_create_demo_user(db)
        reset_demo_data(db, user)
    print(f"Demo profile ready ({DEMO_EMAIL}). Open it from the login screen's 'Demo player' card.")


if __name__ == "__main__":
    seed()
