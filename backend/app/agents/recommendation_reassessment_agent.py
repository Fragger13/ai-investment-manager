from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.financial import OnboardingProfile
from app.services.memory.adaptive_memory_service import reassess_recommendations


def reassess_recommendation_set(db: Session, profile: OnboardingProfile | None, trigger: str = "manual review") -> dict:
    return reassess_recommendations(db, profile, trigger)
