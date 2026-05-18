from app.schemas.financial import OnboardingProfile
from app.services.intelligence import behavior_agent


def profile_behavior(profile: OnboardingProfile) -> dict:
    return behavior_agent(profile)
