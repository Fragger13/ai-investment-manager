from __future__ import annotations

from datetime import UTC, datetime


def build_evidence_items(asset_name: str, source_links: list[dict], supporting: list[dict], conflicting: list[dict], data_timestamp: str) -> list[dict]:
    items = []
    for signal in [*supporting, *conflicting]:
        items.append(
            {
                "sourceName": signal.get("sourceName", "Research source"),
                "sourceUrl": signal.get("sourceUrl", ""),
                "timestamp": signal.get("retrievedAt", data_timestamp),
                "signalType": signal.get("signalType", "market signal"),
                "summary": _shorten(signal.get("summary", signal.get("title", "")), 180),
                "credibilityScore": signal.get("credibilityScore", 50),
                "relevanceScore": signal.get("relevanceScore", 50),
                "recencyScore": _recency_score(signal.get("retrievedAt", data_timestamp)),
                "confidenceContribution": signal.get("confidenceScore", 50),
            }
        )
    for source in source_links:
        items.append(
            {
                "sourceName": source.get("name", "Asset source"),
                "sourceUrl": source.get("url", ""),
                "timestamp": source.get("retrievedAt", data_timestamp),
                "signalType": source.get("supportType", "asset-data"),
                "summary": f"Asset reference for {asset_name}.",
                "credibilityScore": source.get("credibilityScore", 50),
                "relevanceScore": 70,
                "recencyScore": _recency_score(source.get("retrievedAt", data_timestamp)),
                "confidenceContribution": source.get("credibilityScore", 50),
            }
        )
    return _dedupe(items)


def score_evidence(items: list[dict], conflicting_count: int, data_completeness: str = "medium") -> dict:
    if not items:
        return {"evidenceScore": 20, "sourceCount": 0, "dataQualityPenalty": 25}
    source_count = len({item.get("sourceUrl") or item.get("sourceName") for item in items})
    average = sum(
        item.get("credibilityScore", 50) * 0.35
        + item.get("relevanceScore", 50) * 0.3
        + item.get("recencyScore", 50) * 0.2
        + item.get("confidenceContribution", 50) * 0.15
        for item in items
    ) / len(items)
    confirmation_bonus = min(12, max(0, source_count - 1) * 4)
    conflict_penalty = min(18, conflicting_count * 6)
    data_penalty = {"high": 0, "medium": 6, "low": 14}.get(data_completeness, 8)
    score = round(average + confirmation_bonus - conflict_penalty - data_penalty)
    return {
        "evidenceScore": max(5, min(95, score)),
        "sourceCount": source_count,
        "dataQualityPenalty": data_penalty,
    }


def _recency_score(value: str) -> int:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        age_days = max((datetime.now(UTC) - dt.astimezone(UTC)).days, 0)
    except (ValueError, AttributeError):
        age_days = 30
    if age_days <= 2:
        return 95
    if age_days <= 7:
        return 82
    if age_days <= 30:
        return 65
    return 45


def _dedupe(items: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for item in items:
        key = (item.get("sourceUrl"), item.get("signalType"), item.get("summary"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _shorten(value: str, limit: int) -> str:
    value = " ".join((value or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "..."
