from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.memory.adaptive_memory_service import recommendation_history, recommendation_versions, version_recommendations


def version_recommendation_batch(db: Session, recommendations: list[dict], reason: str = "research refresh") -> list[dict]:
    return version_recommendations(db, recommendations, reason)


def recommendation_version_history(db: Session, recommendation_key: str | None = None) -> list[dict]:
    return recommendation_versions(db, recommendation_key)


def recommendation_history_timeline(db: Session) -> list[dict]:
    return recommendation_history(db)
