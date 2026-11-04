# Deploying TactiQ

TactiQ ships as **one Docker image**: the FastAPI backend (RAG + Gemini) and the built web app together, on a single
address. You only need to host that one container, give it two settings, and attach a small disk.

## What you need
| | |
|---|---|
| `GEMINI_API_KEY` | free key from https://aistudio.google.com/apikey |
| `JWT_SECRET` | a new random string: `python -c "import secrets; print(secrets.token_urlsafe(48))"` (Render can generate it for you) |
| A persistent disk mounted at `/data` | where the SQLite database lives (1 GB is plenty) |
| About **2 GB RAM** | PyTorch + the embedding model need ~1 GB. 512 MB plans will crash. |

Everything else has a sensible default (see `.env.production.example`).

## Option A: Render (fewest steps)
1. Push this folder to GitHub (already done).
2. Render dashboard > **New + > Blueprint** > pick the repo. Render reads `render.yaml`.
3. Paste your `GEMINI_API_KEY` when asked. `JWT_SECRET` is generated automatically.
4. Click **Apply**. The first build takes ~10 minutes (it downloads PyTorch and the embedding model and builds the search index).
5. Open the URL Render gives you. Check `https://<your-app>/api/health` shows `"status":"ok"` and `"ai_configured":true`.

`render.yaml` uses the 2 GB **standard** plan and a 1 GB disk. Prices change, so check Render's pricing page.

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
- The image builds the React app, bakes in the embedding model and the search index, and starts `uvicorn`.
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
| Container restarts / "Killed" | Not enough RAM. Use a plan with 2 GB. |
| Coach says "not configured" | `GEMINI_API_KEY` is missing. See `/api/health` (`ai_configured`). |
| Coach says "quota is busy" | Gemini free-tier rate limit. Wait a minute or upgrade the key. |
| Data disappears on redeploy | `/data` is not a persistent disk/volume. |
| Everyone gets "Too many requests" | All users share one IP behind a proxy that is not forwarding `X-Forwarded-For`. Raise the limits. |
