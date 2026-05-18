from fastapi import APIRouter

from app.schemas.financial import DashboardResponse, OnboardingProfile
from app.services.intelligence import build_dashboard

router = APIRouter()


@router.post("/dashboard", response_model=DashboardResponse)
def dashboard(profile: OnboardingProfile) -> dict:
    return build_dashboard(profile)
