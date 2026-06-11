from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.financial import OnboardingProfile
from app.services.memory.adaptive_memory_service import portfolio_drift


def detect_portfolio_drift(db: Session, profile: OnboardingProfile | None = None) -> dict:
    return portfolio_drift(db, profile)
