from __future__ import annotations

from datetime import UTC, datetime


MODEL_VERSION = "research_hybrid_v2.0"
PIPELINE_VERSION = "candidate-score-rerank-v1"
SCORING_VERSION = "multi_signal_safety_v1"


def model_metadata(agent_outputs: list[str], timestamp: str | None = None) -> dict:
    return {
        "modelVersion": MODEL_VERSION,
        "pipelineVersion": PIPELINE_VERSION,
        "scoringVersion": SCORING_VERSION,
        "dataSnapshotTime": timestamp or datetime.now(UTC).isoformat(timespec="seconds"),
        "agentOutputs": agent_outputs,
    }


def initialize_recommendation_performance(recommendation: dict) -> dict:
    validation = recommendation.get("historicalValidation", {})
    return {
        "recommendationId": recommendation.get("id", ""),
        "modelVersion": recommendation.get("modelVersion", MODEL_VERSION),
        "createdAt": recommendation.get("dataTimestamp", datetime.now(UTC).isoformat(timespec="seconds")),
        "reviewDate": recommendation.get("reviewDate", ""),
        "initialPrice": None,
        "currentPrice": None,
        "benchmarkReturn": None,
        "actualReturn": None,
        "expectedReturnRange": recommendation.get("expectedReturn", {}).get("label", ""),
        "hitRate": None,
        "historicalReliability": validation.get("historicalReliability"),
        "historicalWinRate": validation.get("historicalWinRate"),
        "maxDrawdown": validation.get("maxDrawdown"),
        "benchmarkComparison": validation.get("benchmarkComparison", {}),
        "regimePerformance": validation.get("regimePerformance", {}),
        "sampleSize": validation.get("sampleSize"),
        "setupQuality": validation.get("setupQuality"),
        "outcome": "not_enough_time",
        "lessons": [
            "Historical validation is supporting evidence only; it does not predict future returns.",
            validation.get("downgradeReason") or "Track this recommendation after the review date and compare against benchmark.",
        ],
    }


def summarize_validation(recommendations: list[dict]) -> dict:
    if not recommendations:
        return {"status": "empty", "message": "No recommendations to validate."}
    watchlist = sum(1 for rec in recommendations if rec.get("action") == "Watchlist")
    high_risk = sum(1 for rec in recommendations if rec.get("riskLevel") == "High")
    average_evidence = round(sum(rec.get("evidenceScore", 0) for rec in recommendations) / len(recommendations))
    average_reliability = round(sum(rec.get("validationScore", 0) for rec in recommendations) / len(recommendations))
    return {
        "status": "ready",
        "modelVersion": MODEL_VERSION,
        "recommendationCount": len(recommendations),
        "watchlistCount": watchlist,
        "highRiskCount": high_risk,
        "averageEvidenceScore": average_evidence,
        "averageHistoricalReliability": average_reliability,
        "message": "Historical validation is attached as supporting evidence; outcome tracking still requires elapsed review windows.",
    }
