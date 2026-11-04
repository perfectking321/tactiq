from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.security import get_current_user
from app.services.stats import compute_summary

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary")
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return compute_summary(db, user)
