from app.schemas.financial import OnboardingProfile
from app.services.intelligence import health_agent


def score(profile: OnboardingProfile) -> dict:
    return health_agent(profile)
