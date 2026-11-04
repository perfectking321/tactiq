from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User
from app.schemas import Credentials, DemoStatus, MeOut, TokenOut
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.services.demo import DEMO_EMAIL, DEMO_NAME, ensure_demo, reset_demo_data

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: Credentials, db: Session = Depends(get_db)):
    email = body.email.lower()
    if email == DEMO_EMAIL or db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(
        id=user.id,
        email=user.email,
        name=user.profile.name if user.profile else None,
        profile_complete=user.profile is not None,
        is_demo=user.email == DEMO_EMAIL,
    )


@router.get("/demo", response_model=DemoStatus)
def demo_status():
    return DemoStatus(enabled=settings.demo_mode, name=DEMO_NAME)


@router.post("/demo", response_model=TokenOut)
def demo_login(db: Session = Depends(get_db)):
    """One-click login to the demo profile (creates it with sample data on first use)."""
    if not settings.demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo profile is disabled.")
    return TokenOut(access_token=create_access_token(ensure_demo(db).id))


@router.post("/demo/reset", status_code=status.HTTP_204_NO_CONTENT)
def demo_reset(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Rebuild the demo profile's sample data so it ends today. Only the demo profile can do this."""
    if not settings.demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo profile is disabled.")
    if user.email != DEMO_EMAIL:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the demo profile can be reset.")
    reset_demo_data(db, user)
