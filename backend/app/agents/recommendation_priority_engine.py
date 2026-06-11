from __future__ import annotations

from typing import Any


def prioritize_recommendations(recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prioritized = []
    for recommendation in recommendations:
        item = dict(recommendation)
        item["importanceScore"] = _importance_score(item)
        item["confidenceTier"] = _confidence_tier(item)
        item["surfaceGroup"] = _surface_group(item)
        prioritized.append(item)
    prioritized.sort(key=lambda item: _sort_key(item), reverse=True)
    for index, recommendation in enumerate(prioritized, start=1):
        recommendation["priorityOrder"] = index
    return prioritized


def _importance_score(recommendation: dict[str, Any]) -> int:
    goal_priority = recommendation.get("goalPriority") or (recommendation.get("linkedGoals") or [{}])[0].get("priority", 5)
    goal_score = max(0, 100 - (int(goal_priority or 5) - 1) * 12)
    consensus = recommendation.get("consensus") or {}
    portfolio_bonus = 8 if recommendation.get("helpsDiversification") else 0
    urgency = 8 if recommendation.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven"} else 0
    defensive_bonus = 6 if recommendation.get("strategyBucket") == "Defensive" and recommendation.get("marketRegime") in {"risk-off", "high volatility", "defensive"} else 0
    score = (
        goal_score * 0.18
        + recommendation.get("riskAdjustedScore", 0) * 0.18
        + recommendation.get("evidenceScore", 0) * 0.17
        + recommendation.get("convictionScore", 0) * 0.16
        + recommendation.get("validationScore", 0) * 0.1
        + consensus.get("agreementScore", 0) * 0.11
        + recommendation.get("asymmetryScore", 0) * 0.06
        + portfolio_bonus
        + urgency
        + defensive_bonus
    )
    if recommendation.get("recommendationState") == "watchlist" or str(recommendation.get("action", "")).lower() == "watchlist":
        score -= 14
    if recommendation.get("qualityWarnings"):
        score -= min(18, len(recommendation.get("qualityWarnings", [])) * 4)
    return max(1, min(99, round(score)))


def _confidence_tier(recommendation: dict[str, Any]) -> str:
    strength = (recommendation.get("consensus") or {}).get("recommendationStrength", "")
    if strength:
        return strength
    if str(recommendation.get("action", "")).lower() == "watchlist":
        return "Watchlist"
    if recommendation.get("strategyBucket") == "Defensive":
        return "Defensive Allocation"
    if recommendation.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven", "Crypto"}:
        return "Tactical Allocation"
    if recommendation.get("convictionScore", 0) >= 75:
        return "High Conviction"
    return "Moderate Conviction"


def _surface_group(recommendation: dict[str, Any]) -> str:
    if recommendation.get("recommendationState") == "watchlist" or str(recommendation.get("action", "")).lower() == "watchlist":
        return "Watchlist"
    if recommendation.get("qualityWarnings") or recommendation.get("riskLevel") == "High" and recommendation.get("evidenceScore", 0) < 70:
        return "Risks To Review"
    if recommendation.get("assetIntelligenceBacked") and recommendation.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven", "Crypto"}:
        return "Asset Intelligence Picks"
    if recommendation.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven", "Crypto"}:
        return "Tactical Opportunities"
    return "Top Recommendations"


def _sort_key(recommendation: dict[str, Any]) -> tuple[int, int, int]:
    group_rank = {
        "Top Recommendations": 5,
        "Asset Intelligence Picks": 4,
        "Tactical Opportunities": 3,
        "Defensive": 3,
        "Risks To Review": 2,
        "Watchlist": 1,
    }.get(recommendation.get("surfaceGroup", ""), 2)
    return (group_rank, recommendation.get("importanceScore", 0), recommendation.get("finalScore", 0))
