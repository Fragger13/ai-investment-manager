from __future__ import annotations

from typing import Any


def compress_recommendation(recommendation: dict[str, Any]) -> dict[str, Any]:
    rec = dict(recommendation)
    rec["conciseReason"] = _short(rec.get("whyThisMatters") or rec.get("userSpecificReasoning") or "", 145)
    rec["conciseTrigger"] = _short(rec.get("keyTrigger") or rec.get("marketRegimeSummary") or "", 110)
    rec["primaryRisk"] = _short(rec.get("whatCanGoWrong") or rec.get("downsideScenario") or rec.get("riskExplanation") or "", 140)
    rec["cardSummary"] = {
        "action": rec.get("action", "consider"),
        "asset": rec.get("instrumentName", ""),
        "expectedReturn": (rec.get("expectedReturn") or {}).get("label") or rec.get("expectedReturnRange", "Estimate pending"),
        "allocation": rec.get("suggestedAllocationPercentage", rec.get("allocationPercent", 0)),
        "conviction": rec.get("convictionScore", rec.get("confidenceScore", 0)),
        "topReason": rec["conciseReason"],
        "riskLevel": rec.get("riskLevel", "Medium"),
        "linkedGoal": rec.get("goalTag") or (rec.get("linkedGoals") or [{}])[0].get("name", "Profile goals"),
    }
    rec["supportingSignals"] = _dedupe_signal_list(rec.get("supportingSignals", []), limit=5)
    rec["contradictorySignals"] = _dedupe_signal_list(rec.get("contradictorySignals", []), limit=4)
    rec["evidencePoints"] = _dedupe_evidence_list(rec.get("evidencePoints", []), limit=5)
    rec["sourceLinks"] = _dedupe_sources(rec.get("sourceLinks", []), limit=8)
    rec["thesisBullets"] = _short_list(rec.get("thesisBullets", []), 5, 145)
    rec["riskBullets"] = _short_list(rec.get("riskBullets", []), 4, 130)
    rec["fullResearchNotes"] = _short_list(rec.get("fullResearchNotes", []), 8, 180)
    rec["explanationCards"] = [
        {**item, "summary": _ui_safe_summary(item.get("summary", ""), 180)}
        for item in rec.get("explanationCards", [])[:6]
    ]
    return rec


def compress_market_signal(signal: dict[str, Any]) -> dict[str, Any]:
    item = dict(signal)
    beneficiaries = ", ".join((item.get("likelyBeneficiaries") or [])[:3]) or "Not clear"
    losers = ", ".join((item.get("likelyLosers") or [])[:3]) or "Not clear"
    item["cleanSummary"] = {
        "whatHappened": _short(item.get("title") or item.get("summary", ""), 110),
        "whyItMatters": _short(item.get("whyItMatters") or item.get("summary", ""), 145),
        "whoBenefits": beneficiaries,
        "whoSuffers": losers,
        "doesItAffectMe": _short(_affects_user(item), 130),
    }
    item["summary"] = _short(item.get("summary", ""), 260)
    item["whyItMatters"] = _short(item.get("whyItMatters", ""), 180)
    item["evidence"] = _dedupe_evidence_list(item.get("evidence", []), limit=4)
    item["conflictingEvidence"] = _dedupe_evidence_list(item.get("conflictingEvidence", []), limit=3)
    return item


def compress_response_payload(result: dict[str, Any]) -> dict[str, Any]:
    result = dict(result)
    result["signals"] = [compress_market_signal(signal) for signal in result.get("signals", [])[:40]]
    result["assets"] = result.get("assets", [])[:30]
    return result


def _affects_user(signal: dict[str, Any]) -> str:
    related = signal.get("relatedRecommendations") or []
    if related:
        return f"Linked to a suggested action: {', '.join(related[:2])}."
    if signal.get("portfolioRelevance", 0) >= 70:
        return "Likely relevant to your current investments."
    if signal.get("userRelevance", signal.get("relevanceScore", 0)) >= 70:
        return "Likely relevant to your goals or comfort with risk."
    return "Useful context, but not a direct action by itself."


def _dedupe_signal_list(signals: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    unique = []
    for signal in signals:
        key = (signal.get("sourceUrl", ""), signal.get("sourceName", ""), signal.get("summary", "")[:100])
        if key in seen:
            continue
        seen.add(key)
        compact = dict(signal)
        compact["summary"] = _short(compact.get("summary", ""), 220)
        compact["title"] = _short(compact.get("title", compact.get("summary", "")), 100)
        unique.append(compact)
    return sorted(unique, key=lambda item: item.get("confidenceScore", item.get("confidence", 0)), reverse=True)[:limit]


def _dedupe_evidence_list(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    unique = []
    for item in items:
        key = (
            item.get("sourceUrl", ""),
            item.get("source") or item.get("sourceName", ""),
            item.get("summary", "")[:100],
        )
        if key in seen:
            continue
        seen.add(key)
        compact = dict(item)
        compact["summary"] = _short(compact.get("summary", ""), 180)
        unique.append(compact)
    return sorted(unique, key=lambda item: item.get("confidence", item.get("confidenceContribution", item.get("confidenceScore", 0))), reverse=True)[:limit]


def _dedupe_sources(sources: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    unique = []
    for source in sources:
        key = (source.get("url", ""), source.get("name", ""), source.get("supportType", ""))
        if key in seen or not (source.get("url") or source.get("name")):
            continue
        seen.add(key)
        unique.append(source)
    return unique[:limit]


def _short_list(values: list[str], limit: int, char_limit: int) -> list[str]:
    seen: set[str] = set()
    result = []
    for value in values:
        normalized = " ".join(str(value).split())
        key = normalized.lower()[:90]
        if not normalized or key in seen:
            continue
        seen.add(key)
        result.append(_short(normalized, char_limit))
        if len(result) >= limit:
            break
    return result


def _short(value: str, limit: int) -> str:
    value = " ".join(str(value or "").split())
    if len(value) <= limit:
        return _complete_sentence(value)
    sentence_end = max(value.rfind(". ", 0, limit), value.rfind("? ", 0, limit), value.rfind("! ", 0, limit))
    if sentence_end >= 60:
        return _complete_sentence(value[: sentence_end + 1])
    comma = value.rfind(", ", 0, limit)
    if comma >= 80:
        return _complete_sentence(value[:comma])
    words = value[:limit].split()
    return _complete_sentence(" ".join(words[:-1]))


def _ui_safe_summary(value: str, limit: int) -> str:
    text = _short(value, limit)
    if len(text) <= limit:
        return text
    return _short(text, limit)


def _complete_sentence(value: str) -> str:
    text = " ".join(str(value or "").split()).strip().rstrip(" ,;:")
    if not text:
        return text
    return text if text[-1] in ".!?" else f"{text}."
