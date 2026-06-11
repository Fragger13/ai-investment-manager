from __future__ import annotations

from typing import Any

from app.agents.intelligence_compression_agent import compress_recommendation


def consolidate_recommendations(recommendations: list[dict[str, Any]], max_items: int = 12) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    compressed = [compress_recommendation(rec) for rec in recommendations]
    for rec in compressed:
        rec["importanceScore"] = importance_score(rec)
        rec["surfaceGroup"] = rec.get("surfaceGroup") or surface_group(rec)

    deduped = _dedupe_recommendations(compressed)
    ranked = sorted(deduped, key=lambda rec: (rec.get("importanceScore", 0), rec.get("finalScore", 0)), reverse=True)
    selected = _balanced_selection(ranked, max_items=max_items)
    selected.sort(key=lambda rec: (group_rank(rec.get("surfaceGroup")), -rec.get("importanceScore", 0), rec.get("priorityOrder", 999)))
    for index, rec in enumerate(selected, start=1):
        rec["priorityOrder"] = index

    groups = {
        "Top Recommendations": [summary_item(rec) for rec in selected if rec.get("surfaceGroup") == "Top Recommendations"],
        "Asset Intelligence Picks": [summary_item(rec) for rec in selected if rec.get("surfaceGroup") == "Asset Intelligence Picks"],
        "Tactical Opportunities": [summary_item(rec) for rec in selected if rec.get("surfaceGroup") == "Tactical Opportunities"],
        "Watchlist": [summary_item(rec) for rec in selected if rec.get("surfaceGroup") == "Watchlist"],
        "Risks To Review": [summary_item(rec) for rec in selected if rec.get("surfaceGroup") == "Risks To Review"],
    }
    return selected, {
        "totalBeforeConsolidation": len(recommendations),
        "totalAfterDeduplication": len(deduped),
        "totalAfterConsolidation": len(selected),
        "groupCounts": {key: len(value) for key, value in groups.items()},
        "groups": groups,
    }


def importance_score(rec: dict[str, Any]) -> int:
    goal_score = max(20, 100 - int(rec.get("goalPriority") or rec.get("priorityOrder") or 5) * 8)
    conviction = rec.get("convictionScore", rec.get("confidenceScore", 50))
    evidence = rec.get("evidenceScore", rec.get("confidenceScore", 50))
    diversification = 12 if rec.get("helpsDiversification") else -6 if rec.get("concentrationRiskImpact") == "increases" else 2
    urgency = 12 if 0 < rec.get("goalTimeHorizonMonths", 99) <= 12 else 6 if rec.get("goalTimeHorizonMonths", 99) <= 36 else 0
    novelty = min(10, rec.get("noveltyScore", 0) // 10)
    regime = rec.get("finalScoreBreakdown", {}).get("marketRegimeFitScore", rec.get("confidenceScore", 50))
    risk_penalty = {"Low": 0, "Medium": 6, "High": 14}.get(rec.get("riskLevel", "Medium"), 6)
    contradiction_penalty = rec.get("contradictionAnalysis", {}).get("contradictionPenalty", 0) // 2
    watch_penalty = 18 if rec.get("recommendationState") == "watchlist" or rec.get("action") == "watchlist" else 0
    score = (
        goal_score * 0.2
        + conviction * 0.22
        + evidence * 0.18
        + rec.get("riskAdjustedScore", rec.get("finalScore", 50)) * 0.16
        + regime * 0.1
        + diversification
        + urgency
        + novelty
        - risk_penalty
        - contradiction_penalty
        - watch_penalty
    )
    return max(1, min(100, round(score)))


def surface_group(rec: dict[str, Any]) -> str:
    action = str(rec.get("action", "")).lower()
    state = str(rec.get("recommendationState", "")).lower()
    bucket = str(rec.get("bucket", "")).lower()
    if rec.get("qualityWarnings") and any(item in rec["qualityWarnings"] for item in ["high_risk_weak_evidence"]):
        return "Risks To Review"
    if rec.get("assetIntelligenceBacked"):
        return "Asset Intelligence Picks"
    if state == "watchlist" or action == "watchlist" or bucket == "watchlist":
        return "Watchlist"
    if rec.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven", "Crypto"}:
        return "Tactical Opportunities"
    return "Top Recommendations"


def summary_item(rec: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": rec.get("id"),
        "instrumentName": rec.get("instrumentName"),
        "action": rec.get("action"),
        "riskLevel": rec.get("riskLevel"),
        "importanceScore": rec.get("importanceScore"),
        "reason": rec.get("conciseReason"),
        "linkedGoal": rec.get("goalTag"),
    }


def group_rank(group: str | None) -> int:
    order = {"Top Recommendations": 0, "Asset Intelligence Picks": 1, "Tactical Opportunities": 2, "Risks To Review": 3, "Watchlist": 4}
    return order.get(group or "", 4)


def _balanced_selection(ranked: list[dict[str, Any]], max_items: int) -> list[dict[str, Any]]:
    caps = {"Top Recommendations": 4, "Asset Intelligence Picks": 3, "Tactical Opportunities": 3, "Risks To Review": 3, "Watchlist": 3}
    selected = []
    counts = {key: 0 for key in caps}
    for rec in ranked:
        group = rec.get("surfaceGroup") or surface_group(rec)
        if counts.get(group, 0) >= caps.get(group, 2):
            continue
        selected.append(rec)
        counts[group] = counts.get(group, 0) + 1
        if len(selected) >= max_items:
            break
    if len(selected) < min(max_items, len(ranked)):
        seen = {id(rec) for rec in selected}
        for rec in ranked:
            if id(rec) in seen:
                continue
            selected.append(rec)
            if len(selected) >= max_items:
                break
    return selected


def _dedupe_recommendations(recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_asset: dict[str, dict[str, Any]] = {}
    for rec in recommendations:
        key = _asset_key(rec)
        existing = by_asset.get(key)
        if existing is None:
            by_asset[key] = rec
            continue

        preferred, duplicate = _preferred_recommendation(existing, rec)
        preferred["qualityWarnings"] = sorted(set(preferred.get("qualityWarnings", []) + duplicate.get("qualityWarnings", [])))
        preferred["supportingSignals"] = _merge_items(preferred.get("supportingSignals", []), duplicate.get("supportingSignals", []), "sourceUrl", limit=5)
        preferred["contradictorySignals"] = _merge_items(preferred.get("contradictorySignals", []), duplicate.get("contradictorySignals", []), "sourceUrl", limit=4)
        preferred["evidencePoints"] = _merge_items(preferred.get("evidencePoints", []), duplicate.get("evidencePoints", []), "sourceUrl", limit=5)
        preferred["sourceLinks"] = _merge_items(preferred.get("sourceLinks", []), duplicate.get("sourceLinks", []), "url", limit=8)
        preferred["importanceScore"] = max(preferred.get("importanceScore", 0), duplicate.get("importanceScore", 0))
        by_asset[key] = preferred
    return list(by_asset.values())


def _preferred_recommendation(left: dict[str, Any], right: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    left_key = (
        -group_rank(left.get("surfaceGroup")),
        left.get("importanceScore", 0),
        left.get("finalScore", 0),
        left.get("confidenceScore", 0),
    )
    right_key = (
        -group_rank(right.get("surfaceGroup")),
        right.get("importanceScore", 0),
        right.get("finalScore", 0),
        right.get("confidenceScore", 0),
    )
    if right_key > left_key:
        return right, left
    return left, right


def _merge_items(primary: list[dict[str, Any]], secondary: list[dict[str, Any]], url_key: str, limit: int) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    merged = []
    for item in primary + secondary:
        key = (
            str(item.get(url_key, "")),
            str(item.get("sourceName") or item.get("name") or item.get("source", "")),
            str(item.get("summary") or item.get("title") or "")[:80],
        )
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= limit:
            break
    return merged


def _asset_key(rec: dict[str, Any]) -> str:
    return "|".join(
        [
            str(rec.get("instrumentName", "")).strip().lower(),
            str(rec.get("ticker", "")).strip().lower(),
            str(rec.get("assetType", "")).strip().lower(),
        ]
    )
