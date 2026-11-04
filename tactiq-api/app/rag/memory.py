"""Conversation memory: a rolling LLM-written summary of older messages + the most recent turns verbatim.

This keeps prompts short (important on the free Gemini tier) while the coach still remembers earlier
goals, injuries and advice across sessions.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChatMessage, ConversationSummary, User
from app.rag import llm, prompts

RECENT_MESSAGES = 6        # last 3 exchanges are sent verbatim
SUMMARISE_EVERY = 10       # fold older messages into the summary once this many are waiting

log = logging.getLogger(__name__)


def get_summary(db: Session, user: User) -> ConversationSummary:
    s = db.get(ConversationSummary, user.id)
    if s is None:
        s = ConversationSummary(user_id=user.id, summary="", covered_until_id=0)
        db.add(s)
    return s


def recent_messages(db: Session, user: User, limit: int = RECENT_MESSAGES) -> list[ChatMessage]:
    rows = db.scalars(
        select(ChatMessage).where(ChatMessage.user_id == user.id).order_by(ChatMessage.id.desc()).limit(limit)
    ).all()
    return list(reversed(rows))


def maybe_update_summary(db: Session, user: User) -> None:
    """Summarise messages that have fallen out of the recent window. Failures are non-fatal."""
    s = get_summary(db, user)
    recent = recent_messages(db, user)
    if not recent:
        return
    oldest_recent_id = recent[0].id
    pending = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.id > s.covered_until_id, ChatMessage.id < oldest_recent_id)
        .order_by(ChatMessage.id)
    ).all()
    if len(pending) < SUMMARISE_EVERY:
        return
    try:
        s.summary = llm.generate(
            prompts.SUMMARY_SYSTEM,
            prompts.summary_prompt(s.summary, [(m.role, m.content) for m in pending]),
            temperature=0.2,
            max_output_tokens=400,
        )
        s.covered_until_id = pending[-1].id
        db.commit()
    except llm.LLMUnavailable as e:
        log.warning("Memory summary skipped: %s", e)
        db.rollback()


def clear(db: Session, user: User) -> None:
    db.query(ChatMessage).filter(ChatMessage.user_id == user.id).delete()
    db.query(ConversationSummary).filter(ConversationSummary.user_id == user.id).delete()
    db.commit()
