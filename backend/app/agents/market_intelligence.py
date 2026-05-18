from app.schemas.financial import OnboardingProfile
from app.services.intelligence import research_agent


def monitor(profile: OnboardingProfile) -> list[dict]:
    return research_agent(profile)
