from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TrainingSession, User
from app.routers.common import get_owned
from app.schemas import TrainingIn, TrainingOut
from app.security import get_current_user

router = APIRouter(prefix="/training", tags=["training"])


def to_out(s: TrainingSession) -> TrainingOut:
    return TrainingOut.model_validate({**s.__dict__, "load": s.duration_min * s.rpe})


@router.get("", response_model=list[TrainingOut])
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(TrainingSession)
        .where(TrainingSession.user_id == user.id)
        .order_by(TrainingSession.date.desc(), TrainingSession.id.desc())
    )
    return [to_out(s) for s in rows]


@router.post("", response_model=TrainingOut, status_code=status.HTTP_201_CREATED)
def create_session(body: TrainingIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = TrainingSession(user_id=user.id, **body.model_dump())
    db.add(s)
    db.commit()
    return to_out(s)


@router.put("/{item_id}", response_model=TrainingOut)
def update_session(item_id: int, body: TrainingIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = get_owned(db, TrainingSession, item_id, user)
    for field, value in body.model_dump().items():
        setattr(s, field, value)
    db.commit()
    return to_out(s)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned(db, TrainingSession, item_id, user))
    db.commit()
