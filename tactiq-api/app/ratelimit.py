"""Tiny in-memory per-IP rate limiter (single process). Protects logins and the free Gemini quota on a public site.

One sliding one-minute window per (client IP, bucket). Behind a proxy the client IP comes from X-Forwarded-For
(uvicorn --proxy-headers). If you ever run several instances, replace this with a shared limiter (e.g. Redis).
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings

WINDOW = 60.0


def bucket_for(method: str, path: str) -> tuple[str, int] | None:
    p = path[4:] if path.startswith("/api/") else path
    if method == "POST" and p in ("/auth/login", "/auth/register", "/auth/demo"):
        return "auth", settings.rate_limit_auth_per_min
    if method == "POST" and p in ("/chat", "/plans/generate"):
        return "ai", settings.rate_limit_ai_per_min
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.hits: dict[tuple[str, str], deque] = defaultdict(deque)

    async def dispatch(self, request, call_next):
        rule = bucket_for(request.method, request.url.path) if settings.rate_limit_enabled else None
        if rule:
            name, limit = rule
            ip = request.client.host if request.client else "unknown"
            q = self.hits[(ip, name)]
            now = time.monotonic()
            while q and now - q[0] > WINDOW:
                q.popleft()
            if len(q) >= limit:
                retry = max(1, int(WINDOW - (now - q[0])))
                return JSONResponse(
                    {"detail": "Too many requests. Please wait a moment and try again."},
                    status_code=429,
                    headers={"Retry-After": str(retry)},
                )
            q.append(now)
        return await call_next(request)
