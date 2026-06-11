from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.financial import DashboardResponse, OnboardingProfile
from app.services.intelligence import build_dashboard
from app.services.profile_resolution import resolve_profile

router = APIRouter()


@router.post("/dashboard", response_model=DashboardResponse)
def dashboard(profile: OnboardingProfile, db: Session = Depends(get_db)) -> dict:
    return build_dashboard(resolve_profile(db, profile))
