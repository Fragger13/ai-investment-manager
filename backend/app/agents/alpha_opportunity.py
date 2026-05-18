from app.schemas.financial import OnboardingProfile
from app.services.intelligence import build_dashboard


def find_opportunities(profile: OnboardingProfile) -> list[dict]:
    return [rec for rec in build_dashboard(profile)["recommendations"] if rec["strategyType"] == "Short-term opportunity"]
