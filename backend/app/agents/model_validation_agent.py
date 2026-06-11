from __future__ import annotations

from app.services.backtesting_service import summarize_validation


def validate_recommendation_batch(recommendations: list[dict]) -> dict:
    summary = summarize_validation(recommendations)
    failures = []
    for rec in recommendations:
        if not rec.get("evidencePoints"):
            failures.append({"id": rec.get("id"), "reason": "missing_evidence"})
        if not rec.get("invalidationTrigger"):
            failures.append({"id": rec.get("id"), "reason": "missing_invalidation_trigger"})
        if rec.get("action") in {"Buy", "Accumulate", "Buy gradually", "Accumulate gradually"} and rec.get("evidenceScore", 0) < 45:
            failures.append({"id": rec.get("id"), "reason": "weak_evidence_for_active_action"})
    summary["qualityGateFailures"] = failures[:20]
    summary["passed"] = not failures
    return summary
