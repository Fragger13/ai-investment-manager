from __future__ import annotations

from typing import Any


def build_invalidation_rules(recommendation: dict[str, Any]) -> list[dict[str, Any]]:
    rules = [
        {
            "type": "main reason for the idea",
            "trigger": recommendation.get("invalidationTrigger") or recommendation.get("exitOrRebalanceCondition") or "Review this idea if its main supporting information weakens.",
            "severity": "high",
            "suggestedResponse": "Keep it on your watchlist, reduce the amount, or wait for updated information.",
        },
        {
            "type": "maximum suggested share",
            "trigger": f"This grows above {recommendation.get('strictAllocationCap') or recommendation.get('allocationCap') or recommendation.get('suggestedAllocationPercentage')}% of your investments or too much money becomes tied to one area.",
            "severity": "medium",
            "suggestedResponse": "Pause new buying and use future savings to move closer to your suggested mix.",
        },
        {
            "type": "market conditions",
            "trigger": f"Market conditions change meaningfully from {recommendation.get('marketRegime') or 'the current environment'}.",
            "severity": "medium",
            "suggestedResponse": "Review the timing, confidence level, and buying plan before adding more.",
        },
        {
            "type": "supporting information",
            "trigger": "Cautionary information becomes stronger than supporting information or source quality weakens.",
            "severity": "medium",
            "suggestedResponse": "Lower the confidence level and wait for updated information before acting.",
        },
    ]
    if recommendation.get("riskLevel") == "High" or recommendation.get("strategyBucket") in {"Tactical", "Underdog", "Crypto"}:
        rules.append(
            {
                "type": "risk control",
                "trigger": recommendation.get("stopLossLogic") or recommendation.get("stopLossReference") or "The price falls below its tracked support area or price swings become much larger.",
                "severity": "high",
                "suggestedResponse": "Do not add more automatically. Review the idea and the amount you hold first.",
            }
        )
    return rules[:5]
