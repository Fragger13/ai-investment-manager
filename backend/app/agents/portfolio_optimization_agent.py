from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.financial import OnboardingProfile
from app.services.optimization.portfolio_optimizer import optimize_portfolio


def optimize_user_portfolio(db: Session, profile: OnboardingProfile) -> dict:
    return optimize_portfolio(db, profile)

