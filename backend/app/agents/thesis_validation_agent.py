from __future__ import annotations

from typing import Any


def validate_recommendation_thesis(recommendation: dict[str, Any], contradiction_analysis: dict[str, Any], uncertainty_analysis: dict[str, Any]) -> dict[str, Any]:
    score = recommendation.get("convictionScore", recommendation.get("confidenceScore", 50))
    score += min(10, len(recommendation.get("supportingSignals", [])) * 2)
    score -= contradiction_analysis.get("contradictionPenalty", 0)
    if uncertainty_analysis.get("uncertaintyLevel") == "high":
        score -= 10
    elif uncertainty_analysis.get("uncertaintyLevel") == "medium":
        score -= 5
    score = max(5, min(95, round(score)))
    if score >= 75:
        verdict = "strong but not certain"
    elif score >= 55:
        verdict = "reasonable with clear reasons to review it again"
    else:
        verdict = "weak or better kept on the watchlist"
    return {
        "thesisScore": score,
        "verdict": verdict,
        "summary": f"This idea looks {verdict}. Confidence is limited by concerns, uncertainty, and normal market risk.",
        "assumptions": _assumptions(recommendation),
    }


def _assumptions(recommendation: dict[str, Any]) -> list[str]:
    assumptions = [
        f"Market conditions remain close to {recommendation.get('marketRegime') or 'the current environment'}.",
        "Source information remains valid and does not change meaningfully.",
        "User goal priority, surplus, and risk comfort do not materially weaken.",
        "Suggested limits and the review schedule are followed.",
    ]
    expected = recommendation.get("expectedReturn") or {}
    if expected.get("assumptions"):
        assumptions.append(expected["assumptions"])
    return assumptions[:5]
