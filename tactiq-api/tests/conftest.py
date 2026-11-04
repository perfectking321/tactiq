import os
import tempfile
from pathlib import Path

# Must be set before the app is imported.
_tmp = Path(tempfile.mkdtemp())
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["JWT_SECRET"] = "test-secret-not-for-production-use-only-1234567890"
os.environ["GEMINI_API_KEY"] = ""
os.environ["RATE_LIMIT_ENABLED"] = "false"  # the limiter is tested on its own in test_hosting.py

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

PROFILE = {
    "name": "Riya",
    "age": 20,
    "gender": "Female",
    "height_cm": 162,
    "weight_kg": 54,
    "playing_level": "Intermediate",
    "main_goal": "Footwork",
    "injury_status": "None",
    "diet_type": "Vegetarian",
}


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def register(client, email="riya@example.com", password="password123"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(client):
    return register(client)
