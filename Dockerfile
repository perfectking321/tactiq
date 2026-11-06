# TactiQ: one image = the FastAPI backend (RAG + Gemini) + the built React web app, served from a single origin.
# Build from the TACTIQ/ folder:   docker build -t tactiq .
# Run:                             docker run -p 8000:8000 --env-file .env -v tactiq-data:/data tactiq
# Needs roughly 1-2 GB RAM at runtime (PyTorch + the embedding model).

# ---------- 1) build the web app ----------
FROM node:22-slim AS web
WORKDIR /web
COPY tactiq-frontend/package.json tactiq-frontend/package-lock.json ./
RUN npm ci
COPY tactiq-frontend/ ./
RUN npm run build

# ---------- 2) the API image ----------
FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DATA_DIR=/data \
    PORT=8000
WORKDIR /app

# CPU-only PyTorch first (the default wheel pulls ~2 GB of CUDA libraries we do not use), then everything else.
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
COPY tactiq-api/requirements.txt ./
RUN pip install -r requirements.txt

COPY tactiq-api/app ./app
COPY tactiq-api/kb ./kb
COPY tactiq-api/scripts ./scripts

# Bake the embedding model (downloaded once, cached in /app/models) and the search index (built from kb/) into the image,
# so the container starts fast and works offline apart from the Gemini calls. JWT_SECRET is only a build-time placeholder.
RUN JWT_SECRET=build-time-placeholder python -m app.rag.ingest

# The built web app. When /app/static/index.html exists the API serves it and moves all API routes under /api.
COPY --from=web /web/dist ./static

# The server runs as the unprivileged "app" user. /data is where the SQLite database lives: mount a persistent volume there.
# The entrypoint starts as root only to fix the ownership of that volume (hosts mount it as root), then drops to "app".
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home /app app \
    && mkdir -p /data \
    && chown -R app:app /app/index /app/models /data
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT','8000'), timeout=4)"

# $PORT is set by most hosts (Render, Railway, Cloud Run, Fly...). Honour proxy headers so rate limits see real client IPs.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
