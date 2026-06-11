from __future__ import annotations

from app.schemas.financial import OnboardingProfile
from app.services.intelligence import net_worth
from app.services.recommendations.suitability_scoring_service import ProfileContext


def construct_portfolio(profile: OnboardingProfile, context: ProfileContext, goals: list[dict], regime: dict) -> dict:
    worth = max(net_worth(profile), 1)
    current = {
        "equity": profile.stocksValue + profile.mutualFundsValue,
        "debt": profile.epfPpfValue + profile.cashBalance,
        "gold": profile.goldValue,
        "crypto": profile.cryptoValue,
        "realEstate": profile.realEstateValue,
    }
    current_pct = {key: round(value / worth * 100, 1) for key, value in current.items()}
    essential_weight = sum(1 for goal in goals if goal["essential"])
    near_term_weight = sum(1 for goal in goals if goal["horizonBucket"] == "near-term")
    long_term_weight = sum(1 for goal in goals if goal["horizonBucket"] == "long-term")

    equity = 42 + long_term_weight * 4 - near_term_weight * 8 + regime.get("equityBias", 0)
    debt = 30 + essential_weight * 5 + near_term_weight * 10 + regime.get("debtBias", 0)
    gold = 8 + regime.get("goldBias", 0)
    crypto = 3 + regime.get("cryptoBias", 0)
    if not context.panic_risk and context.surplus > 0:
        crypto = max(crypto, 1)
    tactical = 6 if context.short_term_risk_ok else 3
    if context.panic_risk:
        equity -= 10
        debt += 8
        crypto = 0
        tactical = 0
    if context.emergency_gap > 0:
        debt += 15
        equity -= 10
        crypto = 0
        tactical = min(tactical, 3)

    budgets = _normalize(
        {
            "equity": _clamp(equity, 15, 65),
            "debt": _clamp(debt, 15, 70),
            "gold": _clamp(gold, 5, 15),
            "crypto": _clamp(crypto, 0, 5),
            "tactical": _clamp(tactical, 0, 8),
        }
    )
    notes = [
        "Priority goals and near-term timelines increase the stability budget.",
        "Long-term goals can use more equity, but only after emergency and debt pressure are manageable.",
        f"Current market regime is {regime.get('regime', 'balanced')}, so tactical tilts are applied conservatively.",
    ]
    return {
        "currentAllocation": current_pct,
        "targetAllocation": budgets,
        "riskBudget": "defensive" if context.emergency_gap > 0 or context.panic_risk else "balanced" if regime.get("regime") != "risk-on" else "growth-aware",
        "constructionNotes": notes,
    }


def _normalize(values: dict[str, int]) -> dict[str, int]:
    total = sum(values.values()) or 1
    normalized = {key: round(value / total * 100) for key, value in values.items()}
    drift = 100 - sum(normalized.values())
    normalized["debt"] += drift
    return normalized


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, round(value)))
