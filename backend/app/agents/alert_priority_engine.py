from __future__ import annotations

from typing import Any


def prioritize_alerts(alerts: list[dict[str, Any]], limit: int | None = None) -> list[dict[str, Any]]:
    enriched = []
    for alert in alerts:
        item = dict(alert)
        item["priority"] = alert_priority(item)
        item["priorityScore"] = priority_score(item)
        item["surfaceProminently"] = item["priority"] in {"Critical", "Important"}
        enriched.append(item)
    ordered = sorted(enriched, key=lambda item: item["priorityScore"], reverse=True)
    return ordered[:limit] if limit else ordered


def alert_priority(alert: dict[str, Any]) -> str:
    severity = str(alert.get("severity", alert.get("Severity", ""))).lower()
    title = str(alert.get("title", "")).lower()
    drift_type = str(alert.get("driftType", alert.get("type", ""))).lower()
    if severity in {"critical", "high"} and any(term in title for term in ["debt", "deadline", "drift", "concentration", "emi"]):
        return "Critical"
    if severity in {"high", "medium"} or drift_type in {"portfolio", "goal"}:
        return "Important"
    if "watch" in title or severity == "low":
        return "Watchlist"
    return "Informational"


def priority_score(alert: dict[str, Any]) -> int:
    base = {"Critical": 95, "Important": 75, "Watchlist": 45, "Informational": 25}[alert_priority(alert)]
    if alert.get("driftType") == "goal":
        base += 5
    if alert.get("driftType") == "portfolio":
        base += 3
    return min(100, base)
