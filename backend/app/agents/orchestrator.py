from app.agents import alpha_opportunity, behavioral_intelligence, financial_health, investment_strategy, market_intelligence
from app.schemas.financial import OnboardingProfile


def run_all(profile: OnboardingProfile) -> dict:
    return {
        "health": financial_health.score(profile),
        "recommendations": investment_strategy.recommend(profile),
        "market": market_intelligence.monitor(profile),
        "behavior": behavioral_intelligence.profile_behavior(profile),
        "alpha": alpha_opportunity.find_opportunities(profile),
    }
