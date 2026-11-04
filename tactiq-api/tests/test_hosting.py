"""Hosting behaviour: /api health, the rate limiter, and production mode (API under /api + the web app served)."""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

from app.config import settings
from app.ratelimit import RateLimitMiddleware, bucket_for

API_DIR = Path(__file__).resolve().parent.parent


def test_api_health_reports_status_without_secrets(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert set(body) == {"status", "ai_configured", "index_ready", "demo_mode"}
    assert "key" not in str(body).lower().replace("ai_configured", "")
    assert client.get("/health").json() == {"status": "ok"}


def test_dev_mode_keeps_root_routes_and_api_prefix(client):
    assert client.get("/auth/demo").status_code == 200
    assert client.get("/api/auth/demo").status_code == 200


def test_security_headers_present(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_rate_limit_buckets():
    assert bucket_for("POST", "/api/auth/login")[0] == "auth"
    assert bucket_for("POST", "/auth/register")[0] == "auth"
    assert bucket_for("POST", "/api/chat")[0] == "ai"
    assert bucket_for("POST", "/plans/generate")[0] == "ai"
    assert bucket_for("GET", "/api/chat/history") is None
    assert bucket_for("GET", "/api/auth/demo") is None


def test_rate_limiter_blocks_after_limit(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_auth_per_min", 3)
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/auth/login")
    def login():
        return {"ok": True}

    c = TestClient(app)
    codes = [c.post("/api/auth/login").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    blocked = c.post("/api/auth/login")
    assert "Retry-After" in blocked.headers and "Too many requests" in blocked.json()["detail"]


PROD_SCRIPT = r"""
from fastapi.testclient import TestClient
from app.main import app, SERVE_WEB
assert SERVE_WEB, "static index.html should be detected"
c = TestClient(app)
r = c.get("/");                     assert r.status_code == 200 and "SPA-INDEX" in r.text, r.text
r = c.get("/profile");              assert r.status_code == 200 and "SPA-INDEX" in r.text, "page route must serve the app, not the API"
r = c.get("/activity/new?type=match"); assert "SPA-INDEX" in r.text
r = c.get("/assets/app.js");        assert r.status_code == 200 and "immutable" in r.headers["cache-control"]
r = c.get("/favicon.svg");          assert r.status_code == 200 and "<svg" in r.text
r = c.get("/api/health");           assert r.json()["status"] == "ok"
r = c.post("/api/auth/demo");       assert r.status_code == 200 and "access_token" in r.json()
r = c.get("/api/does-not-exist");   assert r.status_code == 404 and r.headers["content-type"].startswith("application/json")
r = c.get("/auth/demo");            assert "SPA-INDEX" in r.text, "root API paths must not exist in production"
r = c.get("/..%2f..%2fapp/config.py"); assert "SPA-INDEX" in r.text and "jwt_secret" not in r.text, "path traversal must not leak files"
r = c.get("/%2e%2e/%2e%2e/app/config.py"); assert "jwt_secret" not in r.text
assert c.get("/api/docs").status_code == 200
print("PROD-OK")
"""


def test_production_mode_serves_web_app_and_api_under_prefix():
    with tempfile.TemporaryDirectory() as tmp:
        static = Path(tmp) / "static"
        (static / "assets").mkdir(parents=True)
        (static / "index.html").write_text("<html>SPA-INDEX</html>", encoding="utf-8")
        (static / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
        (static / "favicon.svg").write_text("<svg></svg>", encoding="utf-8")
        env = {
            **os.environ,
            "STATIC_DIR": str(static),
            "DATABASE_URL": f"sqlite:///{Path(tmp) / 'prod.db'}",
            "JWT_SECRET": "test-secret-not-for-production-use-only-1234567890",
            "GEMINI_API_KEY": "",
            "RATE_LIMIT_ENABLED": "false",
            "DEMO_MODE": "true",
        }
        out = subprocess.run([sys.executable, "-c", PROD_SCRIPT], cwd=API_DIR, env=env, capture_output=True, text=True, timeout=120)
        assert "PROD-OK" in out.stdout, out.stdout + out.stderr
