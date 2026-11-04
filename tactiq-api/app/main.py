from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.routers import auth, chat, checkins, matches, plans, profile, stats, training

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TactiQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

for r in (auth, profile, training, matches, checkins, stats, chat, plans):
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"status": "ok"}
