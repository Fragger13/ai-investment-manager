from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.memory.adaptive_memory_service import adaptive_summary, memory_context


def adaptive_intelligence_summary(db: Session) -> dict:
    return adaptive_summary(db)


def adaptive_context(db: Session) -> dict:
    return memory_context(db)
