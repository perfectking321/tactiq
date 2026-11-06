import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.db import Base, engine
from app.ratelimit import RateLimitMiddleware
from app.routers import auth, chat, checkins, matches, plans, profile, stats, training

log = logging.getLogger("tactiq")
Base.metadata.create_all(bind=engine)

ROUTERS = (auth, profile, training, matches, checkins, stats, chat, plans)
INDEX = settings.static_dir / "index.html"
# Production: the built web app sits in static/ and is served by this API, so every API route lives under /api
# (page URLs such as /profile or /plan must not collide with API paths). Dev: the Vite proxy strips /api, so the
# routes also stay at the root.
SERVE_WEB = INDEX.is_file()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Build the retrieval index on start if the image/checkout does not already have a current one.
    from app.rag.ingest import ensure_index

    ensure_index()
    yield


app = FastAPI(
    title="TactiQ API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if SERVE_WEB else "/docs",
    openapi_url="/api/openapi.json" if SERVE_WEB else "/openapi.json",
    redoc_url=None,
)


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response


app.add_middleware(SecurityHeaders)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

api = APIRouter(prefix="/api")
for r in ROUTERS:
    api.include_router(r.router)


@api.get("/health")
def api_health():
    """Used by hosting health checks. Never reveals secrets, only whether things are configured."""
    return {
        "status": "ok",
        "ai_configured": bool(settings.gemini_api_key),
        "index_ready": (settings.index_dir / "chunks.json").exists(),
        "demo_mode": settings.demo_mode,
    }


app.include_router(api)

if not SERVE_WEB:
    # Dev / tests: keep the root routes (the Vite dev server proxies /api to here with the prefix stripped).
    for r in ROUTERS:
        app.include_router(r.router, include_in_schema=False)


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


if SERVE_WEB:

    class ImmutableAssets(StaticFiles):
        async def get_response(self, path, scope):
            response = await super().get_response(path, scope)
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"  # hashed file names
            return response

    if (settings.static_dir / "assets").is_dir():
        app.mount("/assets", ImmutableAssets(directory=settings.static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        root = settings.static_dir.resolve()
        target = (root / full_path).resolve()
        if full_path and root in target.parents and target.is_file():  # a real file (favicon...), never outside static/
            return FileResponse(target)
        return FileResponse(INDEX, headers={"Cache-Control": "no-cache"})  # React Router renders the page
