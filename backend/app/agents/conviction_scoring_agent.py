from __future__ import annotations

from app.services.recommendations.asset_screening_service import ResearchAsset


def score_conviction(asset: ResearchAsset, fit: dict, goal: dict, regime: dict, supporting: list[dict], conflicting: list[dict], tactical: dict) -> dict:
    source_score = min(len({item.get("sourceUrl") for item in supporting if item.get("sourceUrl")}) * 6, 18)
    goal_score = 14 if asset.asset_key in goal["eligibleAssetKeys"] else -12
    regime_score = {"risk-on": 8, "balanced": 2, "risk-off": -8, "limited-data": -4}.get(regime.get("regime"), 0)
    if asset.asset_key == "debt" and regime.get("regime") == "risk-off":
        regime_score = 10
    if asset.asset_key == "gold" and regime.get("riskScore", 50) > 60:
        regime_score += 5
    if asset.asset_key == "crypto":
        regime_score -= 8
    score = (
        fit.get("suitabilityScore", 50) * 0.35
        + fit.get("confidenceScore", 50) * 0.25
        + tactical.get("tacticalScore", 50) * 0.2
        + source_score
        + goal_score
        + regime_score
        - min(len(conflicting) * 6, 18)
    )
    conviction = max(5, min(95, round(score)))
    return {
        "convictionScore": conviction,
        "convictionLabel": "High" if conviction >= 75 else "Medium" if conviction >= 55 else "Low",
        "convictionDrivers": [
            f"Suitability {fit.get('suitabilityScore', 0)}%",
            f"Research confidence {fit.get('confidenceScore', 0)}%",
            f"Goal fit: {'strong' if goal_score > 0 else 'weak'}",
            f"Market regime: {regime.get('regime', 'balanced')}",
        ],
    }
