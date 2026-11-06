# Deploying TactiQ

TactiQ ships as **one Docker image**: the FastAPI backend (RAG + Gemini) and the built web app together, on a single
address. You only need to host that one container and give it two settings.

The image is **light**: it uses Google's embedding API (`EMBEDDING_BACKEND=gemini`) instead of a local PyTorch model, and the
search index (`tactiq-api/kb_index/`) is committed to git. It runs in roughly 150 MB of RAM, so it fits **free hosting
(512 MB)**. For local development `requirements.txt` still uses the local MiniLM + ChromaDB mode (`EMBEDDING_BACKEND=local`).
If you edit `tactiq-api/kb/`, rebuild the index with `EMBEDDING_BACKEND=gemini python -m app.rag.ingest` and commit `kb_index/`
(the server also rebuilds it by itself on startup if it is out of date).

## What you need
| | |
|---|---|
| `GEMINI_API_KEY` | free key from https://aistudio.google.com/apikey (used for answers **and** for search embeddings) |
| `JWT_SECRET` | a new random string: `python -c "import secrets; print(secrets.token_urlsafe(48))"` (Render can generate it for you) |
| About **512 MB RAM** | enough for the light image. |
| A persistent disk at `/data` (optional) | keeps the SQLite database across restarts. Free plans have none: data resets on restart. |

Everything else has a sensible default (see `.env.production.example`).

## Option A: Render Free (no card)
1. Push this folder to GitHub (already done).
2. Render dashboard > **New + > Web Service** > pick the repo > Language **Docker**, Branch `main`, Instance type **Free**.
3. Environment variables: `GEMINI_API_KEY`, `JWT_SECRET` (use the Generate button), `DEMO_MODE=true`.
   Optional: `GEMINI_MODEL=gemini-flash-latest`, `GEMINI_FALLBACK_MODEL=gemini-flash-lite-latest`.
4. Advanced > **Health Check Path** `/api/health`. Do not add a disk (free plans cannot).
5. **Deploy web service**. The first build takes ~5 minutes. Open the URL and check `/api/health` shows `"status":"ok"` and `"ai_configured":true`.

Or use **New + > Blueprint**: Render reads `render.yaml` (free plan, same settings).

Free-plan limits: the service **sleeps after ~15 minutes idle** (the first visit afterwards takes about a minute) and the
database **resets on every restart or deploy**. The one-click demo profile re-creates itself, so a showcase works fine.
To keep real users' data, use a free Postgres (Neon or Supabase) and set `DATABASE_URL`, or upgrade to a paid plan with a disk.

## Option B: Railway / Fly.io / Google Cloud Run / any Docker host
1. Create a service from this repo and tell it to use the **`Dockerfile`** in the repo root (context = repo root).
2. Add the environment variables from `.env.production.example`.
3. Add a **volume mounted at `/data`** (on Cloud Run use a managed Postgres instead, because its disk is not persistent: set `DATABASE_URL`).
4. Set the health check path to `/api/health`. The container listens on `$PORT` (default 8000).

## Option C: your own server / VPS
```bash
git clone https://github.com/perfectking321/tactiq.git && cd tactiq
cp .env.production.example .env        # then fill in GEMINI_API_KEY and JWT_SECRET
docker compose up -d --build
```
Open `http://<server-ip>:8000`. Put Caddy or nginx in front for HTTPS (the app honours `X-Forwarded-For`).

## Run it on your own computer with Docker
```bash
cp .env.production.example .env        # fill in GEMINI_API_KEY and JWT_SECRET
docker compose up --build
```
Open http://localhost:8000. Your data is kept in the `tactiq-data` volume.

## How it is wired
- The image builds the React app, ships the prebuilt search index (`kb_index/`) and starts `uvicorn`. Search embeddings come from the Gemini API.
- **All API routes are under `/api`** (e.g. `/api/auth/login`). Every other URL serves the web app, so refreshing `/plan` works.
- `GET /api/health` is the health check. It never reveals secrets, only whether the AI key is configured and the index is ready.
- Local development is unchanged: `start.bat` still runs Vite + the API with the `/api` proxy.

## Before you go public
- **Demo profile:** `DEMO_MODE=true` shows the one-click "Demo player" card (and anyone can use it). Set `DEMO_MODE=false` for real users only.
- **Gemini free tier:** it has rate limits. Heavy use shows "The free Gemini quota is busy", and the app retries on a lighter model first. For many users, move the key to a paid Gemini plan.
- **Rate limits:** logins/sign-ups and AI calls are limited per IP (20/min by default; change `RATE_LIMIT_AUTH_PER_MIN` / `RATE_LIMIT_AI_PER_MIN`). The limiter is in-memory, so run **one instance**.
- **Backups:** the database is the `/data/tactiq.db` file. Back up the disk (or use a managed Postgres via `DATABASE_URL`).
- **Secrets:** never commit `.env`. It is git-ignored. If a key was ever shared, rotate it.
- **HTTPS:** Render, Railway, Fly and Cloud Run provide it automatically. On a VPS use Caddy or nginx.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Container restarts / "Killed" | Not enough RAM (the light image needs ~150 MB; the old PyTorch build needed 1-2 GB). |
| Coach says "not configured" | `GEMINI_API_KEY` is missing. See `/api/health` (`ai_configured`). |
| Coach says "quota is busy" | Gemini free-tier rate limit (each question uses one embedding call plus one answer call). Wait a minute or upgrade the key. |
| Data disappears on redeploy | `/data` is not a persistent disk/volume. |
| Everyone gets "Too many requests" | All users share one IP behind a proxy that is not forwarding `X-Forwarded-For`. Raise the limits. |
