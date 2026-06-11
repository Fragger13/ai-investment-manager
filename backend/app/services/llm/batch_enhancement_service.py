from __future__ import annotations

from typing import Any

from app.agents.asset_intelligence_copy_agent import build_asset_intelligence_copy
from app.agents.explainability_agent import build_recommendation_explainability
from app.agents.market_signal_copy_agent import build_market_signal_copy
from app.core.config import settings
from app.services.evidence.evidence_relevance_service import filter_relevant_evidence


def enhance_recommendations_batch(items: list[dict[str, Any]], force: bool = False, max_items: int | None = None) -> list[dict[str, Any]]:
    limit = max_items or settings.llm_batch_recommendation_limit
    enhanced: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if index >= limit:
            enhanced.append(_mark_skipped(item, "batch_limit"))
            continue
        if _already_enhanced(item) and not force:
            enhanced.append(item)
            continue
        try:
            item.update(build_recommendation_explainability(item, llm_enhance=True))
        except Exception as exc:
            item.update(_metadata(False, _fallback_reason(exc)))
        enhanced.append(item)
    return enhanced


def enhance_market_signals_batch(items: list[dict[str, Any]], force: bool = False, max_items: int | None = None) -> list[dict[str, Any]]:
    limit = max_items or settings.llm_batch_market_limit
    enhanced: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if index >= limit:
            enhanced.append(_mark_skipped(item, "batch_limit"))
            continue
        if _already_enhanced(item) and not force:
            enhanced.append(item)
            continue
        try:
            copy = build_market_signal_copy(_market_context(item), llm_enhance=True)
            _apply_market_copy(item, copy)
        except Exception as exc:
            item.update(_metadata(False, _fallback_reason(exc)))
        enhanced.append(item)
    return enhanced


def enhance_asset_intelligence_batch(items: list[dict[str, Any]], force: bool = False, max_items: int | None = None) -> list[dict[str, Any]]:
    limit = max_items or settings.llm_batch_asset_limit
    enhanced: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if index >= limit:
            enhanced.append(_mark_skipped(item, "batch_limit"))
            continue
        if _already_enhanced(item) and not force:
            enhanced.append(item)
            continue
        try:
            evidence = filter_relevant_evidence(item, item.get("evidence", []))
            copy = build_asset_intelligence_copy({**item, "evidence": evidence}, evidence, llm_enhance=True)
            _apply_asset_copy(item, copy, evidence)
        except Exception as exc:
            item.update(_metadata(False, _fallback_reason(exc)))
        enhanced.append(item)
    return enhanced


def _apply_market_copy(item: dict[str, Any], copy: dict[str, Any]) -> None:
    beneficiaries = copy.get("who_benefits") or item.get("likelyBeneficiaries") or []
    risks = copy.get("who_is_at_risk") or item.get("likelyLosers") or []
    item["title"] = copy.get("title") or copy.get("clean_headline") or item.get("title")
    item["clean_headline"] = copy.get("clean_headline") or item.get("clean_headline") or item.get("title")
    item["cleanHeadline"] = item["clean_headline"]
    item["summary"] = copy.get("summary") or item.get("summary")
    item["whyItMatters"] = copy.get("whyItMatters") or copy.get("why_it_matters") or item.get("whyItMatters")
    item["why_it_matters"] = copy.get("why_it_matters") or item.get("whyItMatters")
    item["who_benefits"] = beneficiaries
    item["who_is_at_risk"] = risks
    item["likely_beneficiaries"] = beneficiaries
    item["likely_risks"] = risks
    item["related_assets"] = item.get("relevantInstruments") or item.get("affectedAssets") or []
    item["user_relevance"] = copy.get("user_relevance") or item.get("user_relevance") or item.get("relatedRecommendation") or ""
    item["whatToWatchNext"] = copy.get("whatToWatchNext") or copy.get("what_to_watch_next") or item.get("whatToWatchNext") or ""
    item["what_to_watch_next"] = copy.get("what_to_watch_next") or item["whatToWatchNext"]
    item["cleanSummary"] = {
        **(item.get("cleanSummary") or {}),
        "whatHappened": item["clean_headline"],
        "whyItMatters": item["whyItMatters"],
        "whoBenefits": ", ".join(beneficiaries) or "Not clear",
        "whoSuffers": ", ".join(risks) or "Not clear",
        "doesItAffectMe": item["user_relevance"] or (item.get("cleanSummary") or {}).get("doesItAffectMe", ""),
        "whatToWatchNext": item["whatToWatchNext"],
    }
    _copy_metadata(item, copy)


def _apply_asset_copy(item: dict[str, Any], copy: dict[str, Any], evidence: list[dict[str, Any]]) -> None:
    item["summary"] = copy.get("summary") or item.get("summary")
    item["whyThisMatters"] = copy.get("whyThisMatters") or copy.get("why_this_matters") or item.get("whyThisMatters")
    item["why_this_matters"] = copy.get("why_this_matters") or item.get("whyThisMatters")
    item["whyNow"] = copy.get("whyNow") or copy.get("why_now") or item.get("whyNow")
    item["why_now"] = copy.get("why_now") or item.get("whyNow")
    item["supportingEvidence"] = copy.get("supportingEvidence") or copy.get("supporting_evidence") or item.get("supportingEvidence") or []
    item["supporting_evidence"] = copy.get("supporting_evidence") or item.get("supportingEvidence") or []
    item["risks"] = copy.get("risks") or item.get("risks") or []
    item["dataPoints"] = copy.get("dataPoints") or copy.get("data_points") or item.get("dataPoints") or []
    item["data_points"] = copy.get("data_points") or item.get("dataPoints") or []
    item["invalidationTrigger"] = copy.get("invalidationTrigger") or copy.get("invalidation_trigger") or item.get("invalidationTrigger")
    item["invalidation_trigger"] = copy.get("invalidation_trigger") or item.get("invalidationTrigger")
    item["suitableFor"] = copy.get("suitableFor") or copy.get("suitable_for") or item.get("suitableFor") or ""
    item["suitable_for"] = copy.get("suitable_for") or item["suitableFor"]
    item["evidence"] = evidence
    item["evidenceCount"] = len(evidence)
    _copy_metadata(item, copy)


def _market_context(item: dict[str, Any]) -> dict[str, Any]:
    evidence = item.get("evidence") or []
    compact_evidence = [
        {
            "sourceName": evidence_item.get("sourceName"),
            "sourceUrl": evidence_item.get("sourceUrl"),
            "summary": evidence_item.get("summary"),
            "signalType": evidence_item.get("signalType"),
            "retrievedAt": evidence_item.get("retrievedAt"),
            "confidenceScore": evidence_item.get("confidenceScore") or evidence_item.get("confidenceContribution"),
        }
        for evidence_item in evidence[:4]
        if isinstance(evidence_item, dict)
    ]
    return {
        **item,
        "evidence": compact_evidence,
    }


def _already_enhanced(item: dict[str, Any]) -> bool:
    return bool(item.get("llm_enhanced") or item.get("llmEnhanced"))


def _mark_skipped(item: dict[str, Any], reason: str) -> dict[str, Any]:
    if _already_enhanced(item):
        return item
    item.update(_metadata(False, reason))
    return item


def _copy_metadata(item: dict[str, Any], copy: dict[str, Any]) -> None:
    for key in [
        "llm_enhanced",
        "llm_provider",
        "llm_model",
        "llm_generated_at",
        "llm_fallback_reason",
        "llmEnhanced",
        "llmProvider",
        "llmModel",
        "llmGeneratedAt",
        "llmFallbackReason",
        "llm_enhancement_status",
        "llm_enhancement_pending",
        "llmEnhancementStatus",
        "llmEnhancementPending",
    ]:
        if key in copy:
            item[key] = copy.get(key)
    enhanced = bool(item.get("llm_enhanced") or item.get("llmEnhanced"))
    item["llm_enhancement_status"] = "enhanced" if enhanced else "fallback"
    item["llm_enhancement_pending"] = False
    item["llmEnhancementStatus"] = item["llm_enhancement_status"]
    item["llmEnhancementPending"] = False


def _metadata(enhanced: bool, reason: str) -> dict[str, Any]:
    return {
        "llm_enhanced": enhanced,
        "llm_provider": settings.llm_provider if settings.llm_enabled else "none",
        "llm_model": settings.llm_model_fast or settings.llm_model,
        "llm_fallback_reason": None if enhanced else reason,
        "llmEnhanced": enhanced,
        "llmProvider": settings.llm_provider if settings.llm_enabled else "none",
        "llmModel": settings.llm_model_fast or settings.llm_model,
        "llmFallbackReason": None if enhanced else reason,
        "llm_enhancement_status": "enhanced" if enhanced else "fallback",
        "llm_enhancement_pending": False,
        "llmEnhancementStatus": "enhanced" if enhanced else "fallback",
        "llmEnhancementPending": False,
    }


def _fallback_reason(exc: Exception) -> str:
    text = str(exc).lower()
    if "timeout" in text or "timed out" in text:
        return "ollama_timeout"
    if "json" in text:
        return "invalid_json"
    if "connection" in text or "refused" in text:
        return "ollama_unreachable"
    return "ollama_error"
