from __future__ import annotations

from typing import Any


def analyze_recommendation_uncertainty(recommendation: dict[str, Any], contradiction_analysis: dict[str, Any] | None = None) -> dict[str, Any]:
    contradiction_analysis = contradiction_analysis or {}
    uncertainties = []
    validation = recommendation.get("historicalValidation") or recommendation.get("validation") or {}
    sample_size = validation.get("sampleSize", 0)
    reliability = validation.get("historicalReliability", recommendation.get("validationScore", 0))

    if sample_size and sample_size < 10:
        uncertainties.append(_item("limited past examples", "high", f"Only {sample_size} similar past example(s) were found.", "Treat the past-results check as a weak supporting signal."))
    elif reliability < 45:
        uncertainties.append(_item("mixed past results", "medium", "Similar past ideas did not behave consistently enough.", "Keep this on your watchlist or use a smaller amount."))

    if recommendation.get("dataMode") in {"limited", "fallback", "cached"}:
        uncertainties.append(_item("information freshness", "medium", f"The information status is {recommendation.get('dataMode')}.", "Refresh the information before making a large decision."))

    if contradiction_analysis.get("contradictionCount", 0) > 0:
        uncertainties.append(_item("mixed information", "medium", contradiction_analysis.get("summary", "The available information is mixed."), "Consider adding money gradually and review the concerns first."))

    regime_confidence = recommendation.get("finalScoreBreakdown", {}).get("marketRegimeFitScore", recommendation.get("confidenceScore", 50))
    if regime_confidence < 55:
        uncertainties.append(_item("fit with current market conditions", "medium", "The fit with current market conditions is not strong.", "Do not assume the current timing will last."))

    if recommendation.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven", "Crypto"} or recommendation.get("bucket") in {"tactical", "underdog", "event_driven", "crypto"}:
        uncertainties.append(_item("short-term idea", "medium", "This idea depends more on timing and changing market conditions than a long-term foundation investment.", "Keep the amount small and review it on schedule."))

    if not uncertainties:
        uncertainties.append(_item("normal market uncertainty", "low", "No major extra uncertainty is detected, but returns are still not guaranteed.", "Follow the suggested review schedule and limits."))

    max_severity = "high" if any(item["severity"] == "high" for item in uncertainties) else "medium" if any(item["severity"] == "medium" for item in uncertainties) else "low"
    return {
        "summary": _summary(uncertainties),
        "items": uncertainties[:6],
        "uncertaintyLevel": max_severity,
    }


def _item(kind: str, severity: str, summary: str, action_impact: str) -> dict[str, str]:
    return {"type": kind, "severity": severity, "summary": summary, "actionImpact": action_impact}


def _summary(items: list[dict[str, str]]) -> str:
    if any(item["severity"] == "high" for item in items):
        return "There is enough uncertainty to keep the amount small or leave this on your watchlist."
    if any(item["severity"] == "medium" for item in items):
        return "There is some uncertainty. Consider adding money gradually and review the idea if conditions change."
    return "The level of uncertainty looks normal for an investment idea, but it is not zero."
