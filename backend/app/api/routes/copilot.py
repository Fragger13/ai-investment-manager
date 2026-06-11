from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.financial import OnboardingProfile
from app.services.copilot.daily_action_service import build_financial_copilot
from app.services.profile_resolution import resolve_profile

router = APIRouter()


@router.post("/daily-brief")
def daily_brief(payload: OnboardingProfile | None = None, db: Session = Depends(get_db)) -> dict:
    return build_financial_copilot(db, resolve_profile(db, payload))
