from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.behavioral_drift_agent import detect_behavioral_drift
from app.agents.goal_drift_agent import detect_goal_drift
from app.agents.portfolio_drift_agent import detect_portfolio_drift
from app.core.database import get_db
from app.models.financial_profile import FinancialProfile
from app.schemas.financial import OnboardingProfile
from app.services.memory.adaptive_memory_service import drift_alerts

router = APIRouter()


def _latest_profile(db: Session) -> OnboardingProfile:
    record = db.query(FinancialProfile).order_by(FinancialProfile.id.desc()).first()
    if not record:
        return OnboardingProfile()
    return OnboardingProfile(**json.loads(record.payload_json))


@router.get("/portfolio")
def portfolio(db: Session = Depends(get_db)) -> dict:
    return detect_portfolio_drift(db)


@router.get("/goals")
def goals(db: Session = Depends(get_db)) -> dict:
    return detect_goal_drift(db, _latest_profile(db))


@router.get("/behavior")
def behavior(db: Session = Depends(get_db)) -> dict:
    return detect_behavioral_drift(db, _latest_profile(db))


@router.get("/alerts")
def alerts(db: Session = Depends(get_db)) -> list[dict]:
    return drift_alerts(db)
