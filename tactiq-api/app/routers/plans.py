from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TrainingPlan, User
from app.rag.llm import LLMUnavailable
from app.rag.pipeline import generate_plan
from app.rag.retriever import IndexMissing
from app.schemas import PlanOut
from app.security import get_current_user

router = APIRouter(prefix="/plans", tags=["plans"])


@router.post("/generate", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def generate(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.profile is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Complete your profile first.")
    try:
        return generate_plan(db, user)
    except (LLMUnavailable, IndexMissing) as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
    except ValidationError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI returned an incomplete plan. Please try again.")


@router.get("/latest", response_model=PlanOut)
def latest(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.scalar(
        select(TrainingPlan).where(TrainingPlan.user_id == user.id).order_by(TrainingPlan.id.desc()).limit(1)
    )
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No plan generated yet.")
    return plan
