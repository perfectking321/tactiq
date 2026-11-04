from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Match, User
from app.routers.common import get_owned
from app.schemas import MatchIn, MatchOut, match_result, parse_game_scores
from app.security import get_current_user

router = APIRouter(prefix="/matches", tags=["matches"])


def to_out(m: Match) -> MatchOut:
    games = parse_game_scores(m.game_scores)
    won = sum(1 for a, b in games if a > b)
    return MatchOut.model_validate({
        **m.__dict__,
        "result": match_result(games),
        "games_won": won,
        "games_lost": len(games) - won,
        "points_won": sum(a for a, _ in games),
        "points_lost": sum(b for _, b in games),
    })


@router.get("", response_model=list[MatchOut])
def list_matches(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Match).where(Match.user_id == user.id).order_by(Match.date.desc(), Match.id.desc())
    )
    return [to_out(m) for m in rows]


@router.post("", response_model=MatchOut, status_code=status.HTTP_201_CREATED)
def create_match(body: MatchIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = Match(user_id=user.id, **body.model_dump())
    db.add(m)
    db.commit()
    return to_out(m)


@router.put("/{item_id}", response_model=MatchOut)
def update_match(item_id: int, body: MatchIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = get_owned(db, Match, item_id, user)
    for field, value in body.model_dump().items():
        setattr(m, field, value)
    db.commit()
    return to_out(m)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_match(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned(db, Match, item_id, user))
    db.commit()
