from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Checkin, User
from app.routers.common import get_owned
from app.schemas import CheckinIn, CheckinOut
from app.security import get_current_user
from app.services.stats import wellness_label, wellness_score

router = APIRouter(prefix="/checkins", tags=["checkins"])


def to_out(c: Checkin) -> CheckinOut:
    score = wellness_score(c)
    return CheckinOut.model_validate({**c.__dict__, "score": score, "label": wellness_label(score)})


def _date_taken(db: Session, user: User, body: CheckinIn, exclude_id: int | None = None) -> bool:
    q = select(Checkin.id).where(Checkin.user_id == user.id, Checkin.date == body.date)
    if exclude_id is not None:
        q = q.where(Checkin.id != exclude_id)
    return db.scalar(q) is not None


@router.get("", response_model=list[CheckinOut])
def list_checkins(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Checkin).where(Checkin.user_id == user.id).order_by(Checkin.date.desc()))
    return [to_out(c) for c in rows]


@router.post("", response_model=CheckinOut, status_code=status.HTTP_201_CREATED)
def create_checkin(body: CheckinIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if _date_taken(db, user, body):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already checked in on this date. Edit that entry instead.")
    c = Checkin(user_id=user.id, **body.model_dump())
    db.add(c)
    db.commit()
    return to_out(c)


@router.put("/{item_id}", response_model=CheckinOut)
def update_checkin(item_id: int, body: CheckinIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = get_owned(db, Checkin, item_id, user)
    if _date_taken(db, user, body, exclude_id=item_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Another check-in already exists for that date.")
    for field, value in body.model_dump().items():
        setattr(c, field, value)
    db.commit()
    return to_out(c)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checkin(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned(db, Checkin, item_id, user))
    db.commit()
