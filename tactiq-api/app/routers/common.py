from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User


def get_owned(db: Session, model, item_id: int, user: User):
    """Fetch a row by id, but only if it belongs to the current user (404 otherwise)."""
    item = db.get(model, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    return item
