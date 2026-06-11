from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.financial import OnboardingProfile
from app.services.memory.adaptive_memory_service import behavioral_drift


def detect_behavioral_drift(db: Session, profile: OnboardingProfile) -> dict:
    return behavioral_drift(db, profile)
