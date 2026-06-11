from __future__ import annotations

from app.services.recommendations.asset_screening_service import ResearchAsset
from app.services.recommendations.suitability_scoring_service import ProfileContext


def size_position(context: ProfileContext, asset: ResearchAsset, goal: dict, portfolio_plan: dict, regime: dict) -> dict:
    asset_budget = portfolio_plan["targetAllocation"].get(asset.asset_key, 0)
    priority_multiplier = max(0.45, 1.15 - ((goal["priority"] - 1) * 0.12))
    horizon_multiplier = 0.75 if goal["horizonBucket"] == "near-term" and asset.asset_key != "debt" else 1.0
    regime_multiplier = 0.8 if regime.get("regime") == "risk-off" and asset.asset_key in {"equity", "crypto"} else 1.0
    raw_allocation = round(asset_budget * priority_multiplier * horizon_multiplier * regime_multiplier)
    allocation = _cap_allocation(asset.asset_key, raw_allocation)
    if asset.asset_key == "crypto" and allocation == 0 and not context.panic_risk and context.surplus > 0:
        allocation = 1
    amount = round(context.surplus * allocation / 100)
    if goal["fundingGap"] > 0:
        amount = min(amount, max(round(goal["fundingGap"] / max(goal["timeHorizonMonths"], 1)), amount if goal["priority"] <= 2 else round(amount * 0.8)))
    if asset.asset_key == "crypto":
        amount = min(amount, round(context.surplus * 0.05))
    if asset.asset_key == "tactical":
        amount = min(amount, round(context.surplus * 0.08))
    if asset.asset_key == "debt" and context.emergency_gap > 0:
        amount = max(amount, min(context.emergency_gap, round(context.surplus * 0.6)))
    return {
        "suggestedAllocationPercentage": max(allocation, 0),
        "suggestedMonthlyAmount": max(amount, 0),
        "positionSizingNote": f"Size is based on {goal['name']} priority {goal['priority']}, {goal['horizonBucket']} timeline, surplus, and {regime.get('regime', 'balanced')} regime.",
        "maxSinglePositionPercent": _cap_allocation(asset.asset_key, asset_budget),
    }


def _cap_allocation(asset_key: str, value: int) -> int:
    caps = {"debt": 70, "equity": 60, "gold": 12, "crypto": 5, "tactical": 8}
    return max(0, min(value, caps.get(asset_key, 10)))
