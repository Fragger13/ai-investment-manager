from __future__ import annotations

from sqlalchemy.orm import Session

from app.agents.final_recommendation_orchestrator import generate_final_recommendations
from app.schemas.financial import OnboardingProfile


def generate_advanced_recommendations(profile: OnboardingProfile | None = None, db: Session | None = None) -> dict:
    if db is None:
        from app.core.database import SessionLocal

        with SessionLocal() as session:
            return generate_final_recommendations(session, profile)
    return generate_final_recommendations(db, profile)
