from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.memory.adaptive_memory_service import record_user_action


def learn_from_user_action(db: Session, action: dict, user_id: int | None = None) -> dict:
    return record_user_action(db, action, user_id=user_id)
