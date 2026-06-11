from __future__ import annotations

from typing import Any


def build_reasoning_chain(recommendation: dict[str, Any], evidence_summary: dict[str, Any], contradiction_analysis: dict[str, Any], uncertainty_analysis: dict[str, Any], invalidation_rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    asset = recommendation.get("instrumentName") or recommendation.get("assetName") or "this asset"
    goal = recommendation.get("goalTag") or "your saved goals"
    return [
        _step("Supporting signals", "supportive" if recommendation.get("supportingSignals") else "limited", evidence_summary.get("supportSummary", f"Source-backed support for {asset} is limited.")),
        _step("Supporting information", "supportive" if recommendation.get("evidenceScore", 0) >= 65 else "mixed", f"{asset} has a supporting-signal score of {recommendation.get('evidenceScore', recommendation.get('confidenceScore', 0))}%, so the suggested amount should reflect that level of confidence."),
        _step("Current market conditions", "supportive" if recommendation.get("marketRegime") not in {"limited-data", ""} else "limited", recommendation.get("marketRegimeSummary") or recommendation.get("whyNow") or "Information about current market conditions is limited, so take a gradual approach."),
        _step("How it connects to your goals", "supportive", f"{asset} supports {goal} with priority {recommendation.get('goalPriority') or recommendation.get('priorityOrder')}."),
        _step("Effect on your investments", "supportive" if recommendation.get("helpsDiversification") else "watch", recommendation.get("allocationImpact") or recommendation.get("portfolioRole") or f"The effect of {asset} is estimated from your current investments and suggested mix."),
        _step("Limits to keep risk controlled", "watch" if recommendation.get("riskLevel") == "High" else "supportive", recommendation.get("concentrationImpact") or recommendation.get("riskExplanation") or f"{asset} has a {recommendation.get('riskLevel', 'Medium')} risk label and a suggested limit."),
        _step("How similar ideas behaved before", "supportive" if recommendation.get("validationScore", 0) >= 60 else "watch", _validation_summary(recommendation)),
        _step("What could challenge this idea", "watch" if contradiction_analysis.get("contradictionCount", 0) else "supportive", contradiction_analysis.get("summary", "")),
        _step("Uncertainty", "watch" if uncertainty_analysis.get("uncertaintyLevel") != "low" else "supportive", uncertainty_analysis.get("summary", "")),
        _step("When to review this idea", "watch", invalidation_rules[0]["trigger"] if invalidation_rules else "Review if supporting information weakens."),
    ]


def _step(name: str, status: str, detail: str) -> dict[str, str]:
    return {"step": name, "status": status, "detail": detail}


def _validation_summary(recommendation: dict[str, Any]) -> str:
    validation = recommendation.get("historicalValidation") or recommendation.get("validation") or {}
    if not validation:
        return "A check of similar past ideas is not available yet."
    return f"Similar past ideas scored {validation.get('historicalReliability', 0)}%, based on {validation.get('sampleSize', 0)} examples. The largest past fall was {validation.get('maxDrawdown', 0)}%."
