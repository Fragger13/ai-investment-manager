from app.schemas.financial import OnboardingProfile
from app.services.intelligence import recommendation_agent


def recommend(profile: OnboardingProfile) -> list[dict]:
    return recommendation_agent(profile)
