from __future__ import annotations

from typing import Any

from app.agents.asset_intelligence_copy_agent import build_asset_intelligence_copy
from app.services.evidence.evidence_relevance_service import (
    filter_relevant_evidence,
    infer_sector_theme,
    normalize_asset_class,
)


LIMITED_VALIDATED_DATA = "Limited validated data available."
LIMITED_ASSET_EVIDENCE = "Limited validated evidence available for this asset."


def complete_sentence_summary(value: str | None, limit: int = 180, fallback: str = LIMITED_VALIDATED_DATA) -> str:
    text = " ".join(str(value or "").replace("...", ".").split()).strip().rstrip(" ,;:")
    if not text:
        return fallback
    if len(text) <= limit:
        return _complete_sentence(text)
    window = text[:limit]
    sentence_end = max(window.rfind(". "), window.rfind("? "), window.rfind("! "))
    if sentence_end >= 55:
        return _complete_sentence(window[: sentence_end + 1])
    comma = window.rfind(", ")
    if comma >= 70:
        return _complete_sentence(window[:comma])
    words = window.split()
    return _complete_sentence(" ".join(words[:-1]))


def validate_asset_insight(payload: dict[str, Any], llm_enhance: bool = True) -> dict[str, Any]:
    item = dict(payload)
    item["normalizedAssetClass"] = normalize_asset_class(item.get("assetType", ""), item.get("category", ""))
    item["sectorTheme"] = infer_sector_theme(item.get("assetName") or item.get("instrumentName") or "", item.get("assetType", ""), item.get("category", ""))
    evidence = filter_relevant_evidence(item, _normalize_evidence(item.get("evidence", [])))
    warnings: list[str] = []
    if isinstance(item.get("fundamental"), dict):
        item["fundamental"] = {
            **item["fundamental"],
            "evidence": filter_relevant_evidence(item, _normalize_evidence(item["fundamental"].get("evidence", []))),
        }

    copy = build_asset_intelligence_copy({**item, "evidence": evidence}, evidence, llm_enhance=llm_enhance)
    item["summary"] = copy["summary"]
    item["whyThisMatters"] = copy["whyThisMatters"]
    item["why_this_matters"] = copy.get("why_this_matters", copy["whyThisMatters"])
    item["whyNow"] = copy["whyNow"]
    item["why_now"] = copy.get("why_now", copy["whyNow"])
    item["suitableFor"] = copy.get("suitableFor", "")
    item["suitable_for"] = copy.get("suitable_for", item["suitableFor"])
    item["supportingEvidence"] = copy["supportingEvidence"]
    item["supporting_evidence"] = copy.get("supporting_evidence", copy["supportingEvidence"])
    item["risks"] = copy["risks"]
    item["dataPoints"] = copy["dataPoints"]
    item["data_points"] = copy.get("data_points", copy["dataPoints"])
    item["invalidationTrigger"] = copy.get("invalidationTrigger", copy.get("invalidation_trigger", LIMITED_VALIDATED_DATA))
    item["invalidation_trigger"] = copy.get("invalidation_trigger", item["invalidationTrigger"])
    for key in ["llm_enhanced", "llm_provider", "llm_model", "llm_generated_at", "llm_fallback_reason", "llmEnhanced", "llmProvider", "llmModel", "llmGeneratedAt", "llmFallbackReason"]:
        item[key] = copy.get(key)
    item["suitabilityNotes"] = complete_sentence_summary(item.get("suitabilityNotes"), 220)
    item["riskNotes"] = complete_sentence_summary(item.get("riskNotes"), 220)
    item["evidence"] = evidence
    item["evidenceCount"] = len(evidence) if "evidenceCount" in item else item.get("evidenceCount", len(evidence))
    if len(evidence) == 0:
        warnings.append("No directly relevant evidence remained after asset matching")
        item["summary"] = copy["summary"]
        item["whyNow"] = LIMITED_ASSET_EVIDENCE
    if len(evidence) < 2 and item.get("category", "").lower().find("accumulate") >= 0:
        item["category"] = "Asset intelligence watchlist - limited evidence"
    item["validationWarnings"] = warnings
    return item


def validate_alpha_insight(payload: dict[str, Any]) -> dict[str, Any]:
    item = dict(payload)
    supporting = [complete_sentence_summary(value, 180) for value in item.get("supportingSignals", []) if value]
    conflicting = [complete_sentence_summary(value, 180) for value in item.get("conflictingSignals", []) if value]
    warnings: list[str] = []

    if not supporting:
        warnings.append("supportingSignals had limited validated evidence")
    item["nonObviousReason"] = _validated_section(item.get("nonObviousReason"), supporting, warnings, "nonObviousReason")
    item["keySignal"] = _validated_section(item.get("keySignal"), supporting, warnings, "keySignal")
    item["supportingSignals"] = supporting or [LIMITED_VALIDATED_DATA]
    item["conflictingSignals"] = conflicting
    item["invalidationTrigger"] = complete_sentence_summary(item.get("invalidationTrigger"), 180)
    item["validationWarnings"] = warnings
    return item


def validate_crypto_insight(payload: dict[str, Any]) -> dict[str, Any]:
    item = dict(payload)
    evidence = _normalize_evidence(item.get("evidence", []))
    warnings: list[str] = []

    item["narrative"] = _validated_section(item.get("narrative"), evidence, warnings, "narrative")
    item["riskWarning"] = complete_sentence_summary(item.get("riskWarning"), 180)
    item["evidence"] = evidence
    item["validationWarnings"] = warnings
    return item


def _validated_section(value: str | None, evidence: list[Any], warnings: list[str], section_name: str) -> str:
    if not evidence:
        warnings.append(f"{section_name} lacked direct source evidence")
        return LIMITED_VALIDATED_DATA
    return complete_sentence_summary(value, 220)


def _normalize_evidence(items: list[dict[str, Any]] | list[str] | None) -> list[Any]:
    output: list[Any] = []
    seen: set[tuple[str, str, str]] = set()
    for item in items or []:
        if isinstance(item, str):
            summary = complete_sentence_summary(item, 180)
            key = ("", "", summary.lower())
            if key not in seen and summary != LIMITED_VALIDATED_DATA:
                seen.add(key)
                output.append(summary)
            continue
        summary = complete_sentence_summary(item.get("summary") or item.get("sourceName") or item.get("sourceUrl"), 180)
        source_name = item.get("sourceName") or item.get("source") or "Research source"
        source_url = item.get("sourceUrl") or item.get("url") or ""
        key = (source_url, source_name, summary.lower())
        if key in seen or summary == LIMITED_VALIDATED_DATA and not source_url:
            continue
        seen.add(key)
        compact = dict(item)
        compact["sourceName"] = source_name
        compact["sourceUrl"] = source_url
        compact["summary"] = summary
        output.append(compact)
    return output


def _complete_sentence(value: str) -> str:
    text = " ".join(str(value or "").split()).strip().rstrip(" ,;:")
    if not text:
        return LIMITED_VALIDATED_DATA
    if text.endswith("..."):
        text = text.rstrip(".")
    return text if text[-1] in ".!?" else f"{text}."
