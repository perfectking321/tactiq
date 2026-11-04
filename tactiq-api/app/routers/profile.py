from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Profile, User
from app.schemas import ProfileIn, ProfileOut
from app.security import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    if user.profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not set up yet.")
    return user.profile


@router.put("", response_model=ProfileOut)
def save_profile(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = user.profile or Profile(user_id=user.id)
    for field, value in body.model_dump().items():
        setattr(profile, field, value)
    db.add(profile)
    db.commit()
    return profile
