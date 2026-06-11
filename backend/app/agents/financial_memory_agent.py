from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.financial import OnboardingProfile
from app.services.memory.adaptive_memory_service import snapshot_portfolio, snapshot_profile, timeline


def remember_profile_change(db: Session, profile: OnboardingProfile, source: str = "profile_update") -> dict:
    return snapshot_profile(db, profile, source)


def remember_portfolio_state(db: Session, optimization: dict, source: str = "portfolio_optimization") -> dict:
    return snapshot_portfolio(db, optimization, source)


def financial_timeline(db: Session) -> dict:
    return timeline(db)
