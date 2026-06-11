from __future__ import annotations

from app.services.recommendations.suitability_scoring_service import ProfileContext


def analyze_investor_factors(context: ProfileContext, goals: list[dict]) -> dict:
    liquidity_pressure = 80 if context.emergency_gap > 0 else 35
    goal_urgency = max((100 - min(goal.get("timeHorizonMonths", 120), 120) for goal in goals), default=30)
    risk_capacity = 35
    if context.long_term_growth_ok:
        risk_capacity += 25
    if context.short_term_risk_ok:
        risk_capacity += 20
    if context.panic_risk:
        risk_capacity -= 20
    if context.savings_rate >= 25:
        risk_capacity += 10
    experience = 55
    if context.equity_value > 0:
        experience += 12
    if context.crypto_value > 0:
        experience += 8
    stability = 45 + min(round(context.savings_rate), 35)
    if context.emergency_gap > 0:
        stability -= 20
    return {
        "riskCapacityScore": max(5, min(95, risk_capacity)),
        "liquidityNeedScore": max(5, min(95, liquidity_pressure)),
        "goalUrgencyScore": max(5, min(95, goal_urgency)),
        "incomeStabilityScore": max(5, min(95, stability)),
        "investmentExperienceScore": max(5, min(95, experience)),
        "volatilityToleranceScore": 80 if context.short_term_risk_ok else 62 if context.long_term_growth_ok else 35,
        "drawdownToleranceScore": 78 if context.long_term_growth_ok and not context.panic_risk else 42,
    }
