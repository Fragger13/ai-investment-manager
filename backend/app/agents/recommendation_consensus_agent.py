from __future__ import annotations

from typing import Any


INTELLIGENCE_LAYERS = {
    "user": ("suitabilityScore", "linkedGoals", "goalTag", "investorCluster"),
    "market": ("marketRegime", "marketRegimeSummary", "supportingSignals", "sentimentSignal"),
    "asset": ("assetIntelligenceBacked", "technicalScore", "fundamentalScore", "assetIntelligence"),
    "validation": ("historicalValidation", "validationScore", "strategyReliability"),
    "portfolio": ("portfolioBucket", "allocationImpact", "helpsDiversification", "portfolioOptimizationSummary"),
    "adaptive": ("versionNumber", "whyChanged", "recommendationState", "qualityAudit"),
    "explainability": ("explanationCards", "contradictionAnalysis", "uncertaintyAnalysis", "invalidationRules"),
}


def build_recommendation_consensus(recommendation: dict[str, Any]) -> dict[str, Any]:
    support = _layer_support(recommendation)
    supported_layers = [name for name, meta in support.items() if meta["supported"]]
    contradiction_penalty = _contradiction_penalty(recommendation)
    evidence = _score(recommendation.get("evidenceScore", recommendation.get("confidenceScore", 0)))
    validation = _score(recommendation.get("validationScore", 0))
    portfolio = 72 if recommendation.get("helpsDiversification") else 55
    suitability = _score(recommendation.get("suitabilityScore", 0))
    regime = _score((recommendation.get("finalScoreBreakdown") or {}).get("marketRegimeFitScore", 0))

    layer_score = round(len(supported_layers) / max(len(INTELLIGENCE_LAYERS), 1) * 100)
    final_conviction = round(
        evidence * 0.22
        + validation * 0.14
        + suitability * 0.18
        + portfolio * 0.13
        + regime * 0.12
        + layer_score * 0.21
        - contradiction_penalty
    )
    final_conviction = max(5, min(95, final_conviction))
    final_evidence = max(5, min(95, round(evidence * 0.72 + layer_score * 0.28 - contradiction_penalty / 2)))

    return {
        "supportedLayers": supported_layers,
        "layerSupport": support,
        "agreementScore": layer_score,
        "contradictionSeverity": contradiction_penalty,
        "finalConviction": final_conviction,
        "finalEvidenceScore": final_evidence,
        "recommendationStrength": _strength(recommendation, final_conviction, final_evidence),
        "summary": _summary(supported_layers, contradiction_penalty, final_conviction),
    }


def _layer_support(recommendation: dict[str, Any]) -> dict[str, dict[str, Any]]:
    support: dict[str, dict[str, Any]] = {}
    for layer, fields in INTELLIGENCE_LAYERS.items():
        present = [field for field in fields if _has_value(recommendation.get(field))]
        support[layer] = {
            "supported": bool(present),
            "evidenceFields": present,
            "supportLevel": min(100, 35 + len(present) * 18) if present else 0,
        }
    return support


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (list, tuple, set, dict, str)):
        return bool(value)
    if isinstance(value, (int, float)):
        return value > 0
    return True


def _contradiction_penalty(recommendation: dict[str, Any]) -> int:
    analysis = recommendation.get("contradictionAnalysis") or {}
    penalty = int(analysis.get("contradictionPenalty", 0) or 0)
    conflicting = len(recommendation.get("contradictorySignals") or [])
    failures = len(recommendation.get("qualityGateFailures") or [])
    warnings = len(recommendation.get("qualityWarnings") or [])
    return min(30, penalty + conflicting * 3 + failures * 4 + warnings * 2)


def _score(value: Any) -> int:
    try:
        return max(0, min(100, round(float(value))))
    except (TypeError, ValueError):
        return 0


def _strength(recommendation: dict[str, Any], conviction: int, evidence: int) -> str:
    bucket = recommendation.get("strategyBucket") or recommendation.get("recommendationType")
    action = str(recommendation.get("action", "")).lower()
    if "watch" in action or bucket == "Watchlist":
        return "Watchlist"
    if bucket == "Defensive":
        return "Defensive Allocation"
    if bucket in {"Tactical", "Underdog", "Event-driven", "Crypto"}:
        return "Tactical Allocation" if conviction >= 62 and evidence >= 58 else "Watchlist"
    if conviction >= 76 and evidence >= 70:
        return "High Conviction"
    return "Moderate Conviction"


def _summary(supported_layers: list[str], penalty: int, conviction: int) -> str:
    layer_text = ", ".join(supported_layers[:5]) or "limited layers"
    caveat = " Contradictions are modest." if penalty < 10 else " Contradictions reduce sizing confidence."
    return f"Consensus uses {layer_text}; final conviction is {conviction}%.{caveat}"
