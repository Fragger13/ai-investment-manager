from __future__ import annotations

from app.services.recommendations.asset_screening_service import ResearchAsset


def build_tactical_overlay(asset: ResearchAsset, regime: dict, supporting: list[dict], conflicting: list[dict]) -> dict:
    support_strength = sum(signal.get("confidenceScore", 0) for signal in supporting[:3])
    conflict_strength = sum(signal.get("confidenceScore", 0) for signal in conflicting[:3])
    tactical_score = max(0, min(100, 45 + support_strength // 10 - conflict_strength // 12 - regime.get("riskScore", 50) // 8))
    if asset.asset_key == "debt":
        stop_loss = "No price stop-loss. Exit if credit quality, liquidity, or emergency suitability changes."
    elif asset.asset_key == "equity":
        stop_loss = "No hard stop for long-term SIPs; pause fresh tactical add-ons if drawdown exceeds your stated comfort or thesis breaks."
    elif asset.asset_key == "tactical":
        stop_loss = "Use a defined loss cap before entry; exit or reduce if the sector falls beyond your short-term loss comfort or market regime turns risk-off."
    elif asset.asset_key == "gold":
        stop_loss = "Trim if gold becomes too large relative to portfolio target; treat it as a hedge candidate, not a certain hedge."
    else:
        stop_loss = "Use a strict pre-decided loss cap and avoid adding more after major adverse regulatory or price moves."
    return {
        "tacticalScore": tactical_score,
        "tacticalView": "constructive" if tactical_score >= 65 else "cautious" if tactical_score < 45 else "neutral",
        "stopLossLogic": stop_loss,
        "rebalanceLogic": f"Rebalance back toward portfolio target allocation when {asset.asset_key} drifts more than 5 percentage points from plan.",
    }
