from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ChatMessage, User
from app.rag import memory
from app.rag.llm import LLMUnavailable
from app.rag.pipeline import answer_question
from app.rag.retriever import IndexMissing
from app.schemas import ChatIn, ChatMessageOut, ChatOut
from app.security import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatOut)
def chat(body: ChatIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = answer_question(db, user, body.message.strip())
    except (LLMUnavailable, IndexMissing) as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
    return ChatOut(answer=result.answer, sources=result.sources, safety_flag=result.safety_flag)


@router.get("/history", response_model=list[ChatMessageOut])
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(ChatMessage).where(ChatMessage.user_id == user.id).order_by(ChatMessage.id).limit(200)
    ).all()


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory.clear(db, user)
