from __future__ import annotations

from typing import Any


def analyze_recommendation_contradictions(recommendation: dict[str, Any], evidence_summary: dict[str, Any] | None = None) -> dict[str, Any]:
    evidence_summary = evidence_summary or {}
    contradictions = []

    for item in evidence_summary.get("topContradictingEvidence", [])[:5]:
        contradictions.append(
            {
                "type": item.get("signalType", "conflicting evidence"),
                "severity": _severity_from_confidence(item.get("confidence", 50)),
                "summary": item.get("summary", "Some information points in a different direction for this idea."),
                "source": item.get("source", "Research source"),
                "sourceUrl": item.get("sourceUrl", ""),
                "confidence": item.get("confidence", 50),
            }
        )

    validation = recommendation.get("historicalValidation") or recommendation.get("validation") or {}
    if validation.get("downgradeReason"):
        contradictions.append(
            {
                "type": "past-results check",
                "severity": "high",
                "summary": f"Similar past ideas make this look weaker: {validation.get('downgradeReason')}.",
                "source": "Strategy validation",
                "sourceUrl": "",
                "confidence": validation.get("historicalReliability", 0),
            }
        )

    if recommendation.get("concentrationRiskImpact") == "increases" or "over" in str(recommendation.get("allocationImpact", "")).lower():
        contradictions.append(
            {
                "type": "too much money in one area",
                "severity": "medium",
                "summary": recommendation.get("allocationImpact") or "This can put too much money in one area if it grows beyond the suggested limit.",
                "source": "Investment plan check",
                "sourceUrl": "",
                "confidence": recommendation.get("suitabilityScore", 50),
            }
        )

    if recommendation.get("dataMode") in {"limited", "fallback"}:
        contradictions.append(
            {
                "type": "data quality",
                "severity": "medium",
                "summary": "Some supporting information is limited, so confidence should stay below the strongest level.",
                "source": "Data quality check",
                "sourceUrl": "",
                "confidence": 45,
            }
        )

    if recommendation.get("riskLevel") == "High" and recommendation.get("evidenceScore", 0) < 65:
        contradictions.append(
            {
                "type": "high risk with limited support",
                "severity": "high",
                "summary": "Risk is high while the supporting information is not strong enough to suggest buying without a strict limit.",
                "source": "Risk filter",
                "sourceUrl": "",
                "confidence": recommendation.get("evidenceScore", 0),
            }
        )

    contradictions = _dedupe(contradictions)
    return {
        "summary": _summary(contradictions),
        "items": contradictions[:6],
        "contradictionCount": len(contradictions),
        "contradictionPenalty": min(35, len(contradictions) * 6 + sum(1 for item in contradictions if item["severity"] == "high") * 6),
    }


def _severity_from_confidence(confidence: int) -> str:
    if confidence >= 80:
        return "high"
    if confidence >= 60:
        return "medium"
    return "low"


def _summary(items: list[dict[str, Any]]) -> str:
    if not items:
        return "No major concern is currently linked, but normal investment risk still remains."
    high = sum(1 for item in items if item.get("severity") == "high")
    if high:
        return f"{high} important concern(s) should be reviewed before acting."
    return f"{len(items)} concern(s) are linked. Keep the amount limited and review the idea if conditions change."


def _dedupe(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    unique = []
    for item in items:
        key = (item.get("type", ""), item.get("summary", "")[:120])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique
