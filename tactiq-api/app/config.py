"""Application settings, read once from environment variables / .env."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
# On Windows the model cache uses plain file copies; that is fine (and portable), so hide the warning.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    # A Flash model is available on the Gemini API free tier.
    # Run `python -m app.rag.llm` to list the models your key can use.
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
    # Used automatically when the main model is overloaded or rate-limited.
    gemini_fallback_model: str = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-flash-lite-latest")

    jwt_secret: str = os.getenv("JWT_SECRET", "")
    jwt_expire_hours: int = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'tactiq.db'}")
    cors_origins: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]

    # All paths are relative to the project folder so it can be moved to another laptop.
    # Shows the one-click "Demo player" profile on the login screen. Set DEMO_MODE=false for a real deployment.
    demo_mode: bool = os.getenv("DEMO_MODE", "true").lower() in ("1", "true", "yes")

    kb_dir: Path = BASE_DIR / "kb"
    index_dir: Path = BASE_DIR / "index"
    # The embedding model is cached inside the project so it travels with it (no re-download).
    models_dir: Path = BASE_DIR / "models"
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    top_k: int = 4


settings = Settings()

# Once the embedding model is cached in ./models, run fully offline (no Hugging Face network calls).
_cached_model = settings.models_dir / ("models--" + settings.embedding_model.replace("/", "--"))
if _cached_model.exists():
    os.environ.setdefault("HF_HUB_OFFLINE", "1")

if not settings.jwt_secret:
    raise RuntimeError("JWT_SECRET is not set. Copy .env.example to .env and fill it in.")
