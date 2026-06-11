from __future__ import annotations

from typing import Any


def resolve_recommendation_conflicts(recommendations: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    resolved = []
    conflicts = []
    tactical_by_sector: dict[str, list[dict[str, Any]]] = {}

    for rec in recommendations:
        item = dict(rec)
        sector = _sector_key(item)
        if item.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven"}:
            tactical_by_sector.setdefault(sector, []).append(item)
        resolved.append(item)

    downgrade_names: set[str] = set()
    for sector, items in tactical_by_sector.items():
        if len(items) <= 1:
            continue
        ranked = sorted(items, key=lambda row: row.get("importanceScore", row.get("finalScore", 0)), reverse=True)
        for loser in ranked[1:]:
            conflicts.append({"type": "overlapping_tactical_sector", "sector": sector, "instrumentName": loser.get("instrumentName")})
            downgrade_names.add(loser.get("instrumentName", ""))

    if conflicts:
        for item in resolved:
            if item.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven"} and item.get("instrumentName") in downgrade_names:
                item["recommendationState"] = "watchlist"
                item["action"] = "watchlist"
                item["surfaceGroup"] = "Watchlist"
                item["qualityWarnings"] = sorted(set(item.get("qualityWarnings", []) + ["overlapping_tactical_sector"]))

    return resolved, {"conflicts": conflicts, "conflictCount": len(conflicts)}


def _sector_key(rec: dict[str, Any]) -> str:
    asset_type = str(rec.get("assetType", "")).lower()
    name = str(rec.get("instrumentName", "")).lower()
    if "bank" in asset_type or "bank" in name or "nbfc" in name:
        return "financials"
    if "gold" in asset_type or "gold" in name:
        return "gold"
    if "crypto" in asset_type or rec.get("strategyBucket") == "Crypto":
        return "crypto"
    if "it" in asset_type or "technology" in name or "infosys" in name or "kpit" in name:
        return "technology"
    if "defence" in asset_type or "defence" in name:
        return "defence"
    return asset_type or "general"
