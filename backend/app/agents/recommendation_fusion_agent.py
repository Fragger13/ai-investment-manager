from __future__ import annotations

from typing import Any


def fuse_recommendation_set(recommendations: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    duplicates = 0
    for recommendation in recommendations:
        item = dict(recommendation)
        key = _opportunity_key(item)
        if key not in by_key:
            by_key[key] = item
            continue
        duplicates += 1
        by_key[key] = _merge_recommendations(by_key[key], item)
    fused = list(by_key.values())
    return fused, {
        "inputCount": len(recommendations),
        "outputCount": len(fused),
        "duplicatesMerged": duplicates,
        "fusionAgent": "RecommendationFusionAgent",
    }


def _opportunity_key(recommendation: dict[str, Any]) -> str:
    ticker = str(recommendation.get("ticker") or "").lower()
    name = str(recommendation.get("instrumentName") or recommendation.get("assetName") or "").lower()
    asset_type = str(recommendation.get("assetType") or "").lower()
    return "|".join([ticker or name, asset_type])


def _merge_recommendations(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    preferred, duplicate = _preferred(left, right)
    merged = dict(preferred)
    merged["supportingSignals"] = _dedupe_items([*preferred.get("supportingSignals", []), *duplicate.get("supportingSignals", [])], "sourceUrl")
    merged["contradictorySignals"] = _dedupe_items([*preferred.get("contradictorySignals", []), *duplicate.get("contradictorySignals", [])], "sourceUrl")
    merged["sourceLinks"] = _dedupe_items([*preferred.get("sourceLinks", []), *duplicate.get("sourceLinks", [])], "url")
    merged["evidencePoints"] = _dedupe_items([*preferred.get("evidencePoints", []), *duplicate.get("evidencePoints", [])], "sourceUrl")
    merged["fullResearchNotes"] = _dedupe_strings([*preferred.get("fullResearchNotes", []), *duplicate.get("fullResearchNotes", [])])[:8]
    merged["fusionNotes"] = _dedupe_strings([*preferred.get("fusionNotes", []), f"Merged duplicate opportunity view from {duplicate.get('recommendationType', 'another agent')}."])[:4]
    merged["evidenceScore"] = max(preferred.get("evidenceScore", 0), duplicate.get("evidenceScore", 0))
    merged["convictionScore"] = max(preferred.get("convictionScore", 0), duplicate.get("convictionScore", 0))
    merged["confidenceScore"] = max(preferred.get("confidenceScore", 0), duplicate.get("confidenceScore", 0))
    return merged


def _preferred(left: dict[str, Any], right: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    left_score = _quality_score(left)
    right_score = _quality_score(right)
    return (right, left) if right_score > left_score else (left, right)


def _quality_score(recommendation: dict[str, Any]) -> float:
    return (
        recommendation.get("importanceScore", 0) * 0.25
        + recommendation.get("finalScore", 0) * 0.25
        + recommendation.get("evidenceScore", 0) * 0.2
        + recommendation.get("convictionScore", 0) * 0.2
        + (10 if recommendation.get("assetIntelligenceBacked") else 0)
    )


def _dedupe_items(items: list[dict[str, Any]], preferred_key: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        key = str(item.get(preferred_key) or item.get("sourceUrl") or item.get("url") or item.get("summary") or item.get("title") or item)
        normalized = key.lower()[:160]
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(item)
    return result[:8]


def _dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result = []
    for value in values:
        normalized = " ".join(str(value or "").split())
        key = normalized.lower()[:120]
        if not normalized or key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result
