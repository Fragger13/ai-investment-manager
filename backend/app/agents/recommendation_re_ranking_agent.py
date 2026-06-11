from __future__ import annotations


def score_final_recommendation(rec: dict, cluster: dict, evidence_meta: dict, stock_rank: dict | None = None) -> dict:
    risk_level = rec.get("riskLevel", "Medium")
    concentration_penalty = _concentration_penalty(rec)
    liquidity_penalty = stock_rank.get("liquidityPenalty", 0) if stock_rank else 0
    volatility_penalty = stock_rank.get("volatilityPenalty", 0) if stock_rank else {"Low": 4, "Medium": 10, "High": 20}.get(risk_level, 10)
    data_quality_penalty = evidence_meta.get("dataQualityPenalty", 8)
    market_fit = _market_regime_fit(rec)
    goal_fit = 85 if rec.get("goalPriority", 9) <= 2 else 70
    technical = rec.get("technicalScore", 50)
    fundamental = rec.get("fundamentalScore", 50)
    score = (
        rec.get("suitabilityScore", 50) * 0.18
        + rec.get("convictionScore", 50) * 0.16
        + evidence_meta.get("evidenceScore", rec.get("evidenceScore", 50)) * 0.16
        + rec.get("riskAdjustedScore", 50) * 0.14
        + goal_fit * 0.1
        + market_fit * 0.08
        + technical * 0.07
        + fundamental * 0.06
        + rec.get("noveltyScore", 30) * 0.03
        + rec.get("asymmetryScore", 50) * 0.02
        - concentration_penalty
        - liquidity_penalty
        - volatility_penalty
        - data_quality_penalty
    )
    return {
        "assetId": rec.get("instrumentName", ""),
        "finalScore": max(5, min(95, round(score))),
        "suitabilityScore": rec.get("suitabilityScore", 0),
        "convictionScore": rec.get("convictionScore", 0),
        "evidenceScore": evidence_meta.get("evidenceScore", rec.get("evidenceScore", 0)),
        "riskAdjustedScore": rec.get("riskAdjustedScore", 0),
        "goalFitScore": goal_fit,
        "marketRegimeFitScore": market_fit,
        "technicalTimingScore": technical,
        "fundamentalQualityScore": fundamental,
        "noveltyScore": rec.get("noveltyScore", 0),
        "asymmetryScore": rec.get("asymmetryScore", 0),
        "concentrationPenalty": concentration_penalty,
        "liquidityPenalty": liquidity_penalty,
        "volatilityPenalty": volatility_penalty,
        "dataQualityPenalty": data_quality_penalty,
    }


def apply_quality_gates(rec: dict, cluster: dict, final_score: dict, candidate: dict | None) -> dict:
    failures = []
    if candidate and not candidate.get("liquidityCheckPassed", True):
        failures.append("liquidity_check")
    if candidate and not candidate.get("minimumDataAvailable", True):
        failures.append("minimum_data")
    if final_score["evidenceScore"] < 45:
        failures.append("evidence_quality")
    if rec.get("strategyBucket") in {"Underdog", "Event-driven", "Tactical", "Crypto"} and final_score["finalScore"] < 45:
        failures.append("weak_final_score_for_active_risk")
    if rec.get("strategyBucket") in {"Underdog", "Event-driven", "Tactical"} and final_score["evidenceScore"] < 55:
        failures.append("insufficient_evidence_for_alpha_bucket")
    if rec.get("riskLevel") == "High" and final_score["finalScore"] < 58:
        failures.append("high_risk_score")
    if rec.get("strategyBucket") == "Crypto" and cluster.get("cryptoAllocationCap", 0) <= 0:
        failures.append("crypto_cluster_cap")
    if rec.get("strictAllocationCap", 0) <= 0:
        failures.append("allocation_cap")
    if failures:
        rec["action"] = "Watchlist" if "liquidity_check" not in failures else "Avoid"
        rec["qualityGateFailures"] = failures
    else:
        rec["qualityGateFailures"] = []
    return rec


def rerank_recommendations(recommendations: list[dict]) -> list[dict]:
    return sorted(recommendations, key=lambda item: (item.get("goalPriority", 99), -item.get("finalScore", item.get("riskAdjustedScore", 0))))


def _market_regime_fit(rec: dict) -> int:
    regime = rec.get("marketRegime", "")
    bucket = rec.get("strategyBucket", "")
    if regime == "risk-off" and bucket in {"Defensive", "Core"}:
        return 78
    if regime == "risk-on" and bucket in {"Core", "Tactical", "Event-driven"}:
        return 78
    if regime == "balanced":
        return 70
    return 55


def _concentration_penalty(rec: dict) -> int:
    allocation = rec.get("suggestedAllocationPercentage", 0)
    cap = rec.get("strictAllocationCap", allocation)
    if allocation > cap:
        return 18
    if rec.get("riskLevel") == "High" and allocation > 5:
        return 12
    return 4 if allocation > 10 and rec.get("assetType") == "Equity share" else 0
