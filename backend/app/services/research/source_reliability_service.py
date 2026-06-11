from __future__ import annotations

from app.services.intelligence import now_iso
from app.services.research.source_registry_v2 import SourceDefinitionV2


MODE_ADJUSTMENTS = {
    "live": 6,
    "cached": -4,
    "delayed": -8,
    "limited": -15,
    "fallback": -30,
    "failed": -35,
}


def score_source_reliability(source: SourceDefinitionV2, mode: str, item_count: int, message: str = "") -> dict:
    base = source.reliability_score
    bias_penalty = round(source.bias_risk_score * 0.35)
    mode_adjustment = MODE_ADJUSTMENTS.get(mode, -20)
    availability_adjustment = 4 if item_count > 0 else -18
    if "blocked" in message.lower() or "forbidden" in message.lower():
        availability_adjustment -= 20
    final_score = max(5, min(100, base - bias_penalty + mode_adjustment + availability_adjustment))
    freshness = 90 if mode == "live" else 70 if mode == "cached" else 55 if mode == "delayed" else 35
    return {
        "sourceName": source.source_name,
        "reliabilityScore": source.reliability_score,
        "biasRiskScore": source.bias_risk_score,
        "freshnessScore": freshness,
        "availabilityScore": 85 if item_count > 0 else 25,
        "finalReliabilityScore": final_score,
        "dataMode": mode,
        "message": message[:500],
        "retrievedAt": now_iso(),
    }
