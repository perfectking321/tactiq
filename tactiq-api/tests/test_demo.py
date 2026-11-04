from app.config import settings
from app.services.demo import DEMO_EMAIL
from tests.conftest import register


def demo_headers(client):
    r = client.post("/auth/demo")
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_demo_login_creates_profile_with_data(client):
    assert client.get("/auth/demo").json() == {"enabled": True, "name": "Aarav Mehta"}
    h = demo_headers(client)
    me = client.get("/auth/me", headers=h).json()
    assert (me["email"], me["name"], me["is_demo"], me["profile_complete"]) == (DEMO_EMAIL, "Aarav Mehta", True, True)
    assert len(client.get("/checkins", headers=h).json()) == 30
    assert len(client.get("/matches", headers=h).json()) == 8
    assert client.get("/plans/latest", headers=h).status_code == 200


def test_demo_keeps_changes_until_reset(client):
    h = demo_headers(client)
    sessions_before = len(client.get("/training", headers=h).json())
    client.post("/training", headers=h, json={"date": "2026-10-01", "type": "Recovery", "duration_min": 20, "rpe": 2})

    h2 = demo_headers(client)  # logging in again keeps the change
    assert len(client.get("/training", headers=h2).json()) == sessions_before + 1

    assert client.post("/auth/demo/reset", headers=h).status_code == 204
    assert len(client.get("/training", headers=h).json()) == sessions_before  # same token still works
    assert client.get("/auth/me", headers=h).status_code == 200


def test_only_demo_can_reset_and_demo_email_is_reserved(client):
    other = register(client, "player@example.com")
    assert client.post("/auth/demo/reset", headers=other).status_code == 403
    assert client.post("/auth/register", json={"email": DEMO_EMAIL, "password": "password123"}).status_code == 409


def test_demo_can_be_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", False)
    assert client.get("/auth/demo").json()["enabled"] is False
    assert client.post("/auth/demo").status_code == 404
