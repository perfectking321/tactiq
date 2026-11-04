"""RAG pipeline tests. The LLM and the retriever are replaced with fakes, so these run offline."""

import json

import pytest

from app.rag import llm, pipeline, safety
from app.rag.kb_loader import Chunk, chunk_documents, load_documents
from app.rag.retriever import Hit
from tests.conftest import PROFILE


def _hit(n: int) -> Hit:
    return Hit(Chunk(f"doc{n}#s", f"doc{n}", f"Doc {n}", f"Section {n}", "technique", f"Doc {n} - Section {n}. Text {n}."), 0.9)


class FakeRetriever:
    def __init__(self):
        self.queries = []

    def search(self, query, k=4):
        self.queries.append(query)
        return [_hit(i) for i in range(1, k + 1)]


@pytest.fixture
def fake_rag(monkeypatch):
    calls = []
    retriever = FakeRetriever()

    def fake_generate(system, prompt, **kwargs):
        calls.append({"system": system, "prompt": prompt, **kwargs})
        if kwargs.get("schema") is not None:
            day = {"session_type": "Footwork", "focus": "Six-corner footwork", "duration_min": 60, "target_rpe": 6,
                   "activities": ["Shadow footwork 8 x 30 s [1]"], "nutrition_tip": "Eat dal-rice after."}
            days = [{**day, "day": d} for d in
                    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]]
            return json.dumps({"title": "Week 1", "rationale": "Builds footwork [2].", "safety_note": "Warm up.",
                               "days": days})
        return "Use a split step before each shot [1]. Keep low [3]."

    monkeypatch.setattr(llm, "generate", fake_generate)
    monkeypatch.setattr(pipeline, "get_retriever", lambda: retriever)
    return calls, retriever


# ---------------- safety guardrail ----------------

@pytest.mark.parametrize("message,level", [
    ("How do I improve my backhand clear?", "none"),
    ("What should I eat before a match?", "none"),
    ("I felt a pop in my knee and now it's swollen", "urgent"),
    ("I have chest pain when I play hard", "urgent"),
    ("My ankle is swollen after landing badly", "refer"),
    ("my shoulder pain is 8/10 when smashing", "refer"),
    ("my calf pain is about 5/10", "caution"),
    ("can I take ibuprofen before matches?", "refer"),
    # Regressions found by eval/safety_eval.py
    ("felt like someone kicked me in the back of the heel", "urgent"),
    ("I think I tore my hamstring", "refer"),
    # Badminton vocabulary must not trigger false alarms
    ("how do I kill the shuttle at the net?", "none"),
    ("should I snap my wrist on the drop shot?", "none"),
    ("how do I break my opponent's rhythm?", "none"),
])
def test_safety_levels(message, level):
    assert safety.assess(message).level == level


def test_safety_uses_profile_and_checkin():
    class P:
        injury_status, injury_body_part, pain_level = "Current", "right knee", 8

    class C:
        soreness = 9

    assert safety.assess("plan my week", P()).level == "refer"
    P.pain_level = 3
    assert safety.assess("plan my week", P()).level == "caution"
    assert safety.assess("hello", None, C()).level == "caution"


# ---------------- knowledge base ----------------

def test_knowledge_base_chunks_are_well_formed():
    docs = load_documents()
    chunks = chunk_documents(docs)
    assert len(docs) >= 15
    assert len({c.chunk_id for c in chunks}) == len(chunks), "chunk ids must be unique"
    for doc in docs:
        assert doc["sources"], f"{doc['path']} has no sources"
    for c in chunks:
        assert 20 <= len(c.text.split()) <= 300, c.chunk_id


# ---------------- pipeline ----------------

def test_chat_pipeline_assembles_grounded_prompt(client, auth, fake_rag):
    calls, _ = fake_rag
    client.put("/profile", json=PROFILE, headers=auth)
    client.post("/training", headers=auth, json={"date": "2026-10-01", "type": "Footwork", "duration_min": 45, "rpe": 7})

    r = client.post("/chat", json={"message": "How can I improve my footwork?"}, headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["safety_flag"] is False
    assert [s["ref"] for s in body["sources"]] == [1, 3]  # only cited passages are returned

    prompt = calls[0]["prompt"]
    for expected in ["KNOWLEDGE", "[1] Doc 1 > Section 1", "PLAYER PROFILE", "Level: Intermediate",
                     "goal: Footwork", "diet: Vegetarian", "PLAYER QUESTION", "How can I improve my footwork?"]:
        assert expected in prompt
    assert "TactiQ Coach" in calls[0]["system"]

    history = client.get("/chat/history", headers=auth).json()
    assert [m["role"] for m in history] == ["user", "assistant"]


def test_red_flag_adds_referral_notice(client, auth, fake_rag):
    calls, _ = fake_rag
    r = client.post("/chat", json={"message": "My knee popped and is swollen"}, headers=auth).json()
    assert r["safety_flag"] is True
    assert r["answer"].startswith("**Please stop training now.**")
    assert "POSSIBLE EMERGENCY" in calls[0]["prompt"]


def test_urgent_notice_survives_llm_outage(client, auth, monkeypatch):
    def down(*a, **k):
        raise llm.LLMUnavailable("quota")

    monkeypatch.setattr(llm, "generate", down)
    monkeypatch.setattr(pipeline, "get_retriever", lambda: FakeRetriever())
    r = client.post("/chat", json={"message": "I have chest pain"}, headers=auth)
    assert r.status_code == 200
    assert "seek medical help" in r.json()["answer"].lower()

    normal = client.post("/chat", json={"message": "best grip for smash?"}, headers=auth)
    assert normal.status_code == 503
    assert normal.json()["detail"] == "quota"


def test_follow_up_uses_memory(client, auth, fake_rag):
    calls, retriever = fake_rag
    client.post("/chat", json={"message": "How should I warm up before singles?"}, headers=auth)
    client.post("/chat", json={"message": "and for doubles?"}, headers=auth)
    assert retriever.queries[-1] == "How should I warm up before singles? and for doubles?"
    assert "Player: How should I warm up before singles?" in calls[-1]["prompt"]


def test_plan_generation(client, auth, fake_rag):
    calls, _ = fake_rag
    assert client.post("/plans/generate", headers=auth).status_code == 400  # needs a profile
    client.put("/profile", json=PROFILE, headers=auth)
    r = client.post("/plans/generate", headers=auth)
    assert r.status_code == 201, r.text
    plan = r.json()
    assert len(plan["plan"]["days"]) == 7
    assert {s["ref"] for s in plan["sources"]} == {1, 2}
    assert calls[-1]["schema"].__name__ == "WeeklyPlan"
    assert "EXAMPLE" in calls[-1]["prompt"]
    assert client.get("/plans/latest", headers=auth).json()["id"] == plan["id"]


def test_missing_api_key_gives_clear_message():
    llm._client.cache_clear()
    with pytest.raises(llm.LLMUnavailable, match="GEMINI_API_KEY is missing"):
        llm.generate("system", "prompt")


def test_overloaded_model_falls_back(monkeypatch):
    from google.genai import errors

    calls = []

    class FakeModels:
        def generate_content(self, model, contents, config):
            calls.append(model)
            if len(calls) == 1:
                raise errors.ServerError(503, {"error": {"code": 503, "message": "busy", "status": "UNAVAILABLE"}})
            assert config.automatic_function_calling.disable is True
            return type("R", (), {"text": " fallback answer "})()

    monkeypatch.setattr(llm, "_client", lambda: type("C", (), {"models": FakeModels()})())
    monkeypatch.setattr(llm.settings, "gemini_model", "main-model")
    monkeypatch.setattr(llm.settings, "gemini_fallback_model", "backup-model")
    assert llm.generate("s", "p") == "fallback answer"
    assert calls == ["main-model", "backup-model"]


def test_timestamps_are_sent_as_utc(client, auth, fake_rag):
    client.post("/chat", json={"message": "How do I warm up?"}, headers=auth)
    created = client.get("/chat/history", headers=auth).json()[0]["created_at"]
    assert created.endswith("Z") or created.endswith("+00:00")


def test_urgent_reason_omits_unrelated_profile_injury():
    from types import SimpleNamespace
    from app.rag import safety
    prof = SimpleNamespace(injury_status="Recovering", injury_body_part="knee", pain_level=2)
    r = safety.assess("chest pain and dizzy", prof)
    assert r.level == "urgent"
    assert not any("profile" in x for x in r.reasons)
