from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.financial import OnboardingProfile
from app.services.memory.adaptive_memory_service import goal_drift


def detect_goal_drift(db: Session, profile: OnboardingProfile) -> dict:
    return goal_drift(db, profile)
