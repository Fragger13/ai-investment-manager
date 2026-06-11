from __future__ import annotations

from app.services.recommendations.suitability_scoring_service import ProfileContext


BUCKET_ASSUMPTIONS = {
    "emergency_reserve": {"return": 5, "volatility": 3, "risk": "low", "min": 0, "max": 30},
    "core_long_term_wealth": {"return": 12, "volatility": 18, "risk": "medium", "min": 15, "max": 65},
    "goal_specific_investments": {"return": 8, "volatility": 9, "risk": "medium", "min": 10, "max": 45},
    "tactical_opportunities": {"return": 14, "volatility": 28, "risk": "high", "min": 0, "max": 15},
    "defensive_hedge": {"return": 7, "volatility": 12, "risk": "medium", "min": 5, "max": 18},
    "crypto_high_risk": {"return": 18, "volatility": 65, "risk": "high", "min": 0, "max": 10},
    "cash_buffer": {"return": 4, "volatility": 1, "risk": "low", "min": 2, "max": 20},
}


BUCKET_NAMES = {
    "emergency_reserve": "Emergency savings",
    "core_long_term_wealth": "Long-term investments",
    "goal_specific_investments": "Money for your goals",
    "tactical_opportunities": "Short-term investment ideas",
    "defensive_hedge": "Added stability",
    "crypto_high_risk": "Higher-risk investments",
    "cash_buffer": "Extra cash buffer",
}


def risk_profile(context: ProfileContext) -> str:
    if context.emergency_gap > 0 or context.panic_risk or context.savings_rate < 10:
        return "defensive"
    if context.short_term_risk_ok and context.long_term_growth_ok and context.savings_rate >= 25:
        return "growth"
    if context.long_term_growth_ok:
        return "balanced_growth"
    return "balanced"


def allocation_constraints(context: ProfileContext, regime: dict) -> dict:
    profile = risk_profile(context)
    regime_name = _regime_name(regime)
    tactical_cap = {"defensive": 3, "balanced": 6, "balanced_growth": 9, "growth": 14}[profile]
    crypto_cap = {"defensive": 0, "balanced": 2, "balanced_growth": 4, "growth": 7}[profile]
    single_stock_cap = {"defensive": 3, "balanced": 5, "balanced_growth": 7, "growth": 8}[profile]
    if regime_name in {"risk-off", "bear market", "high volatility"}:
        tactical_cap = max(0, tactical_cap - 3)
        crypto_cap = max(0, crypto_cap - 2)
    if regime_name in {"risk-on", "bull market", "liquidity-driven", "momentum-led"} and profile in {"balanced_growth", "growth"}:
        tactical_cap = min(18, tactical_cap + 2)
    if context.emergency_gap > 0:
        tactical_cap = min(tactical_cap, 3)
        crypto_cap = 0
    return {
        "riskProfile": profile,
        "tacticalAllocationCap": tactical_cap,
        "cryptoAllocationCap": crypto_cap,
        "singleStockCap": single_stock_cap,
        "sectorCap": 22 if profile == "growth" else 18,
        "maxVolatilityScore": {"defensive": 35, "balanced": 48, "balanced_growth": 58, "growth": 68}[profile],
    }


def _regime_name(regime: dict) -> str:
    return (regime.get("regimeName") or regime.get("regime") or "balanced").lower()
