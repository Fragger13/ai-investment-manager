from __future__ import annotations

from sqlalchemy.orm import Session

from app.agents.recommendation_engine_agent import generate_research_backed_recommendations
from app.schemas.financial import OnboardingProfile


def generate_advanced_recommendations(profile: OnboardingProfile | None = None, db: Session | None = None) -> dict:
    if db is None:
        from app.core.database import SessionLocal

        with SessionLocal() as session:
            return generate_research_backed_recommendations(session, profile)
    return generate_research_backed_recommendations(db, profile)
