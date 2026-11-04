from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.schemas import match_result, parse_game_scores
from tests.conftest import PROFILE, register


def test_register_login_and_me(client):
    register(client, "a@example.com", "password123")
    assert client.post("/auth/register", json={"email": "A@example.com", "password": "password123"}).status_code == 409

    bad = client.post("/auth/login", json={"email": "a@example.com", "password": "wrongpass1"})
    assert bad.status_code == 401

    ok = client.post("/auth/login", json={"email": "a@example.com", "password": "password123"})
    headers = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    me = client.get("/auth/me", headers=headers).json()
    assert me["email"] == "a@example.com"
    assert me["profile_complete"] is False


def test_passwords_are_hashed(client):
    register(client, "h@example.com", "password123")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "h@example.com"))
    assert user.password_hash != "password123"
    assert user.password_hash.startswith("$2b$")


@pytest.mark.parametrize("path", ["/auth/me", "/profile", "/training", "/matches", "/checkins", "/stats/summary"])
def test_protected_routes_need_token(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_profile_roundtrip(client, auth):
    assert client.get("/profile", headers=auth).status_code == 404
    r = client.put("/profile", json=PROFILE, headers=auth)
    assert r.status_code == 200, r.text
    assert client.get("/auth/me", headers=auth).json()["profile_complete"] is True

    injured = {**PROFILE, "injury_status": "Current", "pain_level": 6}
    assert client.put("/profile", json=injured, headers=auth).status_code == 422  # body part required
    injured["injury_body_part"] = "Right knee"
    assert client.put("/profile", json=injured, headers=auth).json()["pain_level"] == 6


def test_game_score_parsing():
    assert parse_game_scores("21-18, 19-21,21-15") == [(21, 18), (19, 21), (21, 15)]
    assert match_result([(21, 18), (19, 21), (21, 15)]) == "Win"
    assert match_result([(10, 21), (15, 21)]) == "Loss"
    for bad in ["", "21", "21-21", "40-10", "21-18,21-18,21-18,21-18"]:
        with pytest.raises(ValueError):
            parse_game_scores(bad)


def test_match_needs_a_winner(client, auth):
    base = {"date": "2026-10-01", "opponent": "Arjun", "format": "Singles", "self_rating": 7}
    for bad in ["21-18", "21-18,18-21", "21-10,21-12,21-5"]:
        r = client.post("/matches", json={**base, "game_scores": bad}, headers=auth)
        assert r.status_code == 422, bad
    assert client.post("/matches", json={**base, "game_scores": "21-23,10-21"}, headers=auth).json()["result"] == "Loss"


def test_match_derived_fields(client, auth):
    body = {"date": "2026-10-01", "opponent": "Arjun", "format": "Singles",
            "game_scores": "21-18, 19-21, 21-15", "self_rating": 7}
    m = client.post("/matches", json=body, headers=auth).json()
    assert m["result"] == "Win"
    assert (m["games_won"], m["games_lost"]) == (2, 1)
    assert (m["points_won"], m["points_lost"]) == (61, 54)
    assert m["game_scores"] == "21-18,19-21,21-15"


def test_users_cannot_see_each_others_data(client):
    a = register(client, "a@example.com")
    b = register(client, "b@example.com")
    s = client.post("/training", json={"date": "2026-10-01", "type": "Footwork", "duration_min": 60, "rpe": 6},
                    headers=a).json()

    assert len(client.get("/training", headers=a).json()) == 1
    assert client.get("/training", headers=b).json() == []
    assert client.delete(f"/training/{s['id']}", headers=b).status_code == 404
    assert client.put(f"/training/{s['id']}", headers=b,
                      json={"date": "2026-10-01", "type": "Strength", "duration_min": 5, "rpe": 1}).status_code == 404
    assert client.delete(f"/training/{s['id']}", headers=a).status_code == 204


def test_one_checkin_per_day(client, auth):
    body = {"date": "2026-10-05", "sleep_hours": 7, "energy": 7, "soreness": 3, "stress": 3, "water_l": 2.5}
    first = client.post("/checkins", json=body, headers=auth)
    assert first.status_code == 201
    assert client.post("/checkins", json=body, headers=auth).status_code == 409
    upd = client.put(f"/checkins/{first.json()['id']}", json={**body, "energy": 9}, headers=auth)
    assert upd.json()["energy"] == 9


def test_stats_summary(client, auth):
    today = date.today()
    for i in range(4):
        client.post("/training", headers=auth, json={
            "date": (today - timedelta(days=i * 7)).isoformat(), "type": "Footwork", "duration_min": 60, "rpe": 5})
    client.post("/matches", headers=auth, json={
        "date": today.isoformat(), "opponent": "X", "format": "Doubles", "game_scores": "15-21,18-21", "self_rating": 5})
    client.post("/checkins", headers=auth, json={
        "date": today.isoformat(), "sleep_hours": 8, "energy": 8, "soreness": 2, "stress": 3, "water_l": 3})

    s = client.get("/stats/summary", headers=auth).json()
    assert s["kpis"]["training_sessions"] == 4
    assert s["kpis"]["training_hours"] == 4.0
    assert s["kpis"]["load_last_7_days"] == 300
    assert s["kpis"]["acwr"] == 1.0
    assert s["kpis"]["win_rate"] == 0.0
    assert s["latest_checkin"]["is_today"] is True
    assert s["latest_checkin"]["score"] == 88  # mean(10, 8, 9, 8) x 10
    assert len(s["weekly_training"]) == 8



def test_checkin_includes_wellness_score(client, auth):
    body = {"date": "2026-10-05", "sleep_hours": 8, "energy": 8, "soreness": 2, "stress": 3, "water_l": 3}
    c = client.post("/checkins", json=body, headers=auth).json()
    assert (c["score"], c["label"]) == (88, "Good to train")
    assert client.get("/checkins", headers=auth).json()[0]["score"] == 88
