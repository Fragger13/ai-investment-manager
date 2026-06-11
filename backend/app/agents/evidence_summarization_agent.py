from __future__ import annotations

from typing import Any


def summarize_recommendation_evidence(recommendation: dict[str, Any]) -> dict[str, Any]:
    supporting = _rank_evidence(_supporting_items(recommendation))
    conflicting = _rank_evidence(_conflicting_items(recommendation))
    return {
        "topSupportingEvidence": supporting[:5],
        "topContradictingEvidence": conflicting[:5],
        "supportSummary": _support_summary(supporting),
        "contradictionSummary": _contradiction_summary(conflicting),
        "sourceCount": recommendation.get("sourceCount") or len({item.get("sourceUrl") or item.get("source") for item in supporting + conflicting}),
    }


def _supporting_items(recommendation: dict[str, Any]) -> list[dict[str, Any]]:
    items = []
    for item in recommendation.get("evidencePoints", []) or recommendation.get("evidence", []):
        signal_type = str(item.get("signalType", "")).lower()
        if "conflict" not in signal_type and "contradict" not in signal_type:
            items.append(_normalize_evidence(item, "supporting"))
    for signal in recommendation.get("supportingSignals", []):
        items.append(_normalize_signal(signal, "supporting"))
    return items


def _conflicting_items(recommendation: dict[str, Any]) -> list[dict[str, Any]]:
    items = []
    for item in recommendation.get("evidencePoints", []) or recommendation.get("evidence", []):
        signal_type = str(item.get("signalType", "")).lower()
        if "conflict" in signal_type or "contradict" in signal_type:
            items.append(_normalize_evidence(item, "contradicting"))
    for signal in recommendation.get("contradictorySignals", []):
        items.append(_normalize_signal(signal, "contradicting"))
    return items


def _normalize_evidence(item: dict[str, Any], support_type: str) -> dict[str, Any]:
    confidence = item.get("confidence") or item.get("confidenceContribution") or item.get("confidenceScore") or 50
    return {
        "source": item.get("source") or item.get("sourceName") or "Research source",
        "sourceUrl": item.get("sourceUrl", ""),
        "timestamp": item.get("timestamp") or item.get("retrievedAt") or "",
        "signalType": item.get("signalType", support_type),
        "confidence": _clamp(confidence),
        "summary": item.get("summary", ""),
        "supportType": support_type,
        "credibilityScore": _clamp(item.get("credibilityScore", confidence)),
    }


def _normalize_signal(signal: dict[str, Any], support_type: str) -> dict[str, Any]:
    confidence = signal.get("confidenceScore", 50)
    return {
        "source": signal.get("sourceName", "Research source"),
        "sourceUrl": signal.get("sourceUrl", ""),
        "timestamp": signal.get("retrievedAt") or signal.get("publishedAt") or "",
        "signalType": signal.get("signalType", support_type),
        "confidence": _clamp(confidence),
        "summary": signal.get("summary") or signal.get("title", ""),
        "supportType": support_type,
        "credibilityScore": _clamp(signal.get("credibilityScore", confidence)),
    }


def _rank_evidence(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    unique = []
    for item in items:
        key = (item.get("source", ""), item.get("sourceUrl", ""), item.get("summary", "")[:90])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return sorted(unique, key=lambda item: (item.get("confidence", 0), item.get("credibilityScore", 0)), reverse=True)


def _support_summary(items: list[dict[str, Any]]) -> str:
    if not items:
        return "Supporting information is limited for this suggestion, so treat it carefully until the information is refreshed."
    lead = items[0]
    summary = _brief(lead.get("summary", ""), 90)
    detail = f": {summary}" if summary else "."
    return (
        f"{len(items)} supporting item(s) are linked. Strongest source: {lead.get('source', 'research source')} "
        f"({lead.get('confidence', 0)}% confidence){detail}"
    )


def _contradiction_summary(items: list[dict[str, Any]]) -> str:
    if not items:
        return "No direct source-backed concern is linked yet, but market changes and the ability to buy or sell can still affect the outcome."
    lead = items[0]
    summary = _brief(lead.get("summary", ""), 90)
    detail = f": {summary}" if summary else "."
    return f"{len(items)} cautionary item(s) are linked. Main concern: {lead.get('signalType', 'market risk')} from {lead.get('source', 'research source')}{detail}"


def _clamp(value: Any) -> int:
    try:
        return max(0, min(100, round(float(value))))
    except (TypeError, ValueError):
        return 50


def _brief(value: str, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    sentence_end = max(text.rfind(". ", 0, limit), text.rfind("; ", 0, limit))
    if sentence_end >= 45:
        return text[: sentence_end + 1].strip()
    words = text[:limit].split()
    return " ".join(words[:-1]).rstrip(" ,;:")
