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
    # Ranking is class-agnostic: what matters is how well the idea fits THIS user
    # and advances their goals — so personalized suitability + factor quality +
    # goal priority drive the score, not the asset class.
    score = (
        goal_score * 0.18
        + recommendation.get("suitabilityScore", 0) * 0.14
        + recommendation.get("riskAdjustedScore", 0) * 0.14
        + recommendation.get("factorScore", 0) * 0.10
        + recommendation.get("evidenceScore", 0) * 0.11
        + recommendation.get("convictionScore", 0) * 0.12
        + recommendation.get("validationScore", 0) * 0.08
        + consensus.get("agreementScore", 0) * 0.07
        + recommendation.get("asymmetryScore", 0) * 0.04
        + portfolio_bonus
        + urgency
        + defensive_bonus
        # Bounded community-sentiment nudge: at most +6 / -5, gated by mention count
        # so noisy chatter can refine — never decide — the quant pick.
        + _community_nudge((recommendation.get("sentimentSignal") or {}).get("community"))
    )
    if recommendation.get("recommendationState") == "watchlist" or str(recommendation.get("action", "")).lower() == "watchlist":
        score -= 14
    if recommendation.get("qualityWarnings"):
        score -= min(18, len(recommendation.get("qualityWarnings", [])) * 4)
    return max(1, min(99, round(score)))


def _community_nudge(community: Any) -> float:
    """Small, bounded adjustment from Reddit community sentiment. Returns 0 unless
    there is enough chatter (>= 3 mentions); caps at +6 (positive) / -5 (negative)
    and scales with mention count so it can refine ranking but not flip a pick."""
    if not isinstance(community, dict):
        return 0.0
    mentions = int(community.get("mentionCount", 0) or 0)
    if mentions < 3:
        return 0.0
    sentiment_score = float(community.get("sentimentScore", 50) or 50)
    strength = min(1.0, mentions / 12)
    return max(-5.0, min(6.0, (sentiment_score - 50) / 8 * strength))


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
    # Class-agnostic: rank purely by how well the idea serves the user (importance
    # score blends goal priority + suitability + factor quality + conviction).
    # The only structural floor is that not-yet-actionable "watchlist" ideas sink
    # below actionable ones — a great fund, stock, bond, or crypto can otherwise
    # outrank any other class if it is genuinely better for this user's goals.
    actionable = 0 if (recommendation.get("recommendationState") == "watchlist" or str(recommendation.get("action", "")).lower() == "watchlist") else 1
    return (actionable, recommendation.get("importanceScore", 0), recommendation.get("finalScore", 0))
