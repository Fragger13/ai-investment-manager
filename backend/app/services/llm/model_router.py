from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Callable

from app.core.config import settings
from app.services.llm.llm_cache import get_llm_cache, make_llm_cache_key, set_llm_cache
from app.services.llm.llm_client import LLMUnavailable
from app.services.llm.llm_observability import record_llm_event
from app.services.llm.ollama_client import OllamaClient
from app.services.llm.prompt_registry import (
    asset_explanation_prompt,
    chat_prompt,
    goal_clarify_prompt,
    goal_estimate_prompt,
    market_explanation_prompt,
    market_signal_copy_prompt,
    recommendation_explanation_prompt,
)
from app.services.llm.schemas import LLMRequest, LLMTask


def generate_chat_answer(message: str, context: dict[str, Any], fallback_answer: str) -> str:
    prompt = chat_prompt(message, context, fallback_answer)
    return _complete_text("chat", prompt, fallback_answer)


def refine_goal_estimate(
    goal_type: str,
    answers: dict[str, Any],
    profile_ctx: dict[str, Any],
    baseline: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Refine a deterministic goal-cost baseline with the LLM. Returns
    (payload, metadata); payload is the deterministic baseline when the model is
    unavailable, so callers can read metadata["llm_enhanced"] for the source."""
    prompt = goal_estimate_prompt(goal_type, answers, profile_ctx, baseline)
    payload, metadata = _complete_json_with_metadata("goal_estimate", prompt, baseline)
    if not isinstance(payload, dict):
        return baseline, metadata
    return payload, metadata


def generate_goal_clarify(
    description: str,
    profile_ctx: dict[str, Any],
    fallback: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Ask the LLM for clarifying questions tailored to a free-form goal. Returns
    (payload, metadata); payload is the fallback when the model is unavailable."""
    prompt = goal_clarify_prompt(description, profile_ctx)
    payload, metadata = _complete_json_with_metadata("goal_clarify", prompt, fallback)
    if not isinstance(payload, dict):
        return fallback, metadata
    return payload, metadata


def summarize_text(text: str, max_words: int = 30, fallback: str | None = None) -> str:
    """Rewrite long copy into a single tight sentence using the summarize model.

    Returns the original text (or fallback) when the LLM is unavailable so
    callers can use this as a transparent post-processor.
    """
    cleaned = " ".join(str(text or "").split()).strip()
    if not cleaned:
        return fallback or ""
    base = fallback if fallback is not None else cleaned
    # Skip the LLM call if the text is already short enough.
    if len(cleaned.split()) <= max_words:
        return cleaned
    prompt = (
        "Rewrite the following text for an Indian retail investor in one short, plain English sentence. "
        f"Stay under {max_words} words. Do not add new information. Do not add a disclaimer. "
        f"Return only the rewritten sentence with no preamble.\n\nText: {cleaned}"
    )
    return _complete_text("summarize", prompt, base)


def refine_recommendation_explanation_cards(recommendation: dict[str, Any], cards: list[dict[str, str]]) -> list[dict[str, str]]:
    prompt = recommendation_explanation_prompt(recommendation, cards)
    payload = _complete_json("recommendation_explanation", prompt, {"cards": cards})
    refined = payload.get("cards") if isinstance(payload, dict) else None
    return _valid_cards(refined, cards)


def refine_recommendation_explainability(recommendation: dict[str, Any], fallback_payload: dict[str, Any]) -> dict[str, Any]:
    prompt = recommendation_explanation_prompt(_compact_recommendation_context(recommendation), fallback_payload.get("explanationCards", []))
    payload, metadata = _complete_json_with_metadata("recommendation_explanation", prompt, fallback_payload)
    if not isinstance(payload, dict):
        payload = fallback_payload
    fallback_cards = fallback_payload.get("explanationCards", [])
    cards = _cards_from_short_payload(payload, fallback_cards)
    if cards == fallback_cards:
        cards = _valid_cards(payload.get("cards") or payload.get("explanation_cards"), fallback_cards)
    if cards == fallback_cards:
        cards = _cards_from_answers(payload.get("answers"), fallback_cards)
    output = {
        **fallback_payload,
        "explanationCards": cards,
        "explanation_cards": _snake_cards(cards),
        "advancedAnalysis": _safe_text(payload.get("a") or payload.get("advanced_analysis") or payload.get("advancedAnalysis"), fallback_payload.get("advancedAnalysis"), limit=520),
        "advanced_analysis": _safe_text(payload.get("a") or payload.get("advanced_analysis") or payload.get("advancedAnalysis"), fallback_payload.get("advanced_analysis"), limit=520),
        "fullResearchSummary": _safe_text(payload.get("r") or payload.get("full_research_summary") or payload.get("fullResearchSummary"), fallback_payload.get("fullResearchSummary"), limit=700),
        "full_research_summary": _safe_text(payload.get("r") or payload.get("full_research_summary") or payload.get("fullResearchSummary"), fallback_payload.get("full_research_summary"), limit=700),
    }
    return {**output, **metadata}


def refine_asset_copy(asset: dict[str, Any], evidence: list[dict[str, Any]], fallback_copy: dict[str, Any]) -> dict[str, Any]:
    prompt = asset_explanation_prompt(asset, evidence, fallback_copy)
    payload, metadata = _complete_json_with_metadata("asset_explanation", prompt, fallback_copy)
    if not isinstance(payload, dict):
        return {**fallback_copy, **metadata}
    return {
        "summary": _safe_text(payload.get("s") or payload.get("summary"), fallback_copy.get("summary")),
        "whyThisMatters": _safe_text(payload.get("m") or payload.get("why_this_matters") or payload.get("whyThisMatters"), fallback_copy.get("whyThisMatters")),
        "why_this_matters": _safe_text(payload.get("m") or payload.get("why_this_matters") or payload.get("whyThisMatters"), fallback_copy.get("why_this_matters")),
        "whyNow": _safe_grounded_asset_text(payload.get("n") or payload.get("why_now") or payload.get("whyNow"), fallback_copy.get("whyNow")),
        "why_now": _safe_grounded_asset_text(payload.get("n") or payload.get("why_now") or payload.get("whyNow"), fallback_copy.get("why_now")),
        "supportingEvidence": _safe_list(payload.get("e") or payload.get("supporting_evidence") or payload.get("supportingEvidence"), fallback_copy.get("supportingEvidence", [])),
        "supporting_evidence": _safe_list(payload.get("e") or payload.get("supporting_evidence") or payload.get("supportingEvidence"), fallback_copy.get("supporting_evidence", [])),
        "risks": _safe_list(payload.get("r") or payload.get("risks"), fallback_copy.get("risks", [])),
        "dataPoints": _safe_list(payload.get("dataPoints"), fallback_copy.get("dataPoints", [])),
        "data_points": _safe_list(payload.get("data_points") or payload.get("dataPoints"), fallback_copy.get("data_points", [])),
        "invalidationTrigger": _safe_text(payload.get("i") or payload.get("invalidation_trigger") or payload.get("invalidationTrigger"), fallback_copy.get("invalidationTrigger"), limit=220),
        "invalidation_trigger": _safe_text(payload.get("i") or payload.get("invalidation_trigger") or payload.get("invalidationTrigger"), fallback_copy.get("invalidation_trigger"), limit=220),
        "suitableFor": _safe_text(payload.get("u") or payload.get("suitable_for") or payload.get("suitableFor"), fallback_copy.get("suitableFor"), limit=220),
        "suitable_for": _safe_text(payload.get("u") or payload.get("suitable_for") or payload.get("suitableFor"), fallback_copy.get("suitable_for"), limit=220),
        **metadata,
    }


def refine_market_explainability(signal: dict[str, Any], fallback_explainability: dict[str, Any]) -> dict[str, Any]:
    prompt = market_explanation_prompt(signal, fallback_explainability)
    payload = _complete_json("market_explanation", prompt, fallback_explainability)
    if not isinstance(payload, dict):
        return fallback_explainability
    output = dict(fallback_explainability)
    for key in [
        "whySignalMatters",
        "beneficiaryRationale",
        "loserRationale",
        "confidenceExplanation",
        "contradictionExplanation",
        "regimeDependence",
    ]:
        output[key] = _safe_text(payload.get(key), fallback_explainability.get(key))
    return output


def refine_market_signal_copy(signal: dict[str, Any], fallback_copy: dict[str, Any]) -> dict[str, Any]:
    prompt = market_signal_copy_prompt(signal, fallback_copy)
    payload, metadata = _complete_json_with_metadata("market_signal_copy", prompt, fallback_copy)
    if not isinstance(payload, dict):
        return {**fallback_copy, **metadata}
    headline = payload.get("h") or payload.get("clean_headline") or payload.get("title")
    return {
        **fallback_copy,
        "title": _safe_text(headline, fallback_copy.get("title"), limit=120),
        "clean_headline": _safe_text(headline, fallback_copy.get("clean_headline") or fallback_copy.get("title"), limit=120),
        "summary": _safe_text(payload.get("s") or payload.get("summary"), fallback_copy.get("summary"), limit=260),
        "whyItMatters": _safe_text(payload.get("m") or payload.get("why_it_matters") or payload.get("whyItMatters"), fallback_copy.get("whyItMatters"), limit=220),
        "why_it_matters": _safe_text(payload.get("m") or payload.get("why_it_matters") or payload.get("whyItMatters"), fallback_copy.get("why_it_matters"), limit=220),
        "who_benefits": _safe_labels(payload.get("b") or payload.get("who_benefits"), fallback_copy.get("who_benefits", [])),
        "who_is_at_risk": _safe_labels(payload.get("r") or payload.get("who_is_at_risk"), fallback_copy.get("who_is_at_risk", [])),
        "whatToWatchNext": _safe_text(payload.get("w") or payload.get("what_to_watch_next") or payload.get("whatToWatchNext"), fallback_copy.get("whatToWatchNext"), limit=220),
        "what_to_watch_next": _safe_text(payload.get("w") or payload.get("what_to_watch_next") or payload.get("whatToWatchNext"), fallback_copy.get("what_to_watch_next"), limit=220),
        "user_relevance": _safe_text(payload.get("u") or payload.get("user_relevance"), fallback_copy.get("user_relevance"), limit=220),
        **metadata,
    }


def ollama_reachable() -> bool:
    if settings.llm_provider.lower() != "ollama":
        return False
    return OllamaClient().is_reachable()


def ollama_model_available(model: str | None = None) -> bool:
    if settings.llm_provider.lower() != "ollama":
        return False
    configured_model = model or settings.llm_model_fast or settings.llm_model
    return OllamaClient().has_model(configured_model)


def _complete_text(task: LLMTask, prompt: str, fallback: str) -> str:
    response = _call(task, prompt, expect_json=False, fallback=lambda: fallback)
    return _safe_text(response, fallback, limit=900)


def _complete_json(task: LLMTask, prompt: str, fallback: Any) -> Any:
    return _call(task, prompt, expect_json=True, fallback=lambda: fallback)


def _complete_json_with_metadata(task: LLMTask, prompt: str, fallback: Any) -> tuple[Any, dict[str, Any]]:
    return _call_with_metadata(task, prompt, expect_json=True, fallback=lambda: fallback)


def _complete_text_with_metadata(task: LLMTask, prompt: str, fallback: str) -> tuple[str, dict[str, Any]]:
    value, metadata = _call_with_metadata(task, prompt, expect_json=False, fallback=lambda: fallback)
    return _safe_text(value, fallback, limit=160), metadata


def _call(task: LLMTask, prompt: str, expect_json: bool, fallback: Callable[[], Any]) -> Any:
    value, _metadata = _call_with_metadata(task, prompt, expect_json, fallback)
    return value


def _call_with_metadata(task: LLMTask, prompt: str, expect_json: bool, fallback: Callable[[], Any]) -> tuple[Any, dict[str, Any]]:
    if not _enabled():
        return fallback(), _metadata(False, task, "llm_disabled")
    model = _model_for_task(task)
    cache_key = make_llm_cache_key(task, model, prompt)
    cached = get_llm_cache(cache_key)
    if cached is not None:
        return cached, _metadata(True, task, None)
    client = OllamaClient()
    last_error = ""
    for _ in range(_attempts_for_task(task)):
        try:
            response = client.generate(
                LLMRequest(
                    task=task,
                    prompt=prompt,
                    model=model,
                    expect_json=expect_json,
                    timeout_seconds=_timeout_for_task(task),
                    metadata={"num_predict": _num_predict_for_task(task, expect_json)},
                )
            )
            record_llm_event({"task": task, "provider": response.provider, "model": model, "ok": response.ok, "fallback": False, "elapsedMs": response.elapsed_ms})
            if not response.ok:
                continue
            cleaned = _strip_thinking(response.text)
            value: Any = _parse_json(cleaned) if expect_json else cleaned
            set_llm_cache(cache_key, value)
            return value, _metadata(True, task, None)
        except Exception as exc:
            last_error = str(exc)
    record_llm_event({"task": task, "provider": settings.llm_provider, "model": model, "ok": False, "fallback": True, "elapsedMs": 0, "error": last_error[:160]})
    return fallback(), _metadata(False, task, _fallback_reason(last_error))


def _enabled() -> bool:
    return bool(settings.llm_enabled) and settings.llm_provider.lower() == "ollama"


_MODEL_CACHE: dict[str, Any] = {"ts": 0.0, "models": set()}


def _available_models() -> set[str]:
    """Installed Ollama model names (lowercased), cached for 5 minutes."""
    now = time.time()
    cached = _MODEL_CACHE.get("models")
    if cached and now - float(_MODEL_CACHE.get("ts", 0.0)) < 300:
        return cached  # type: ignore[return-value]
    try:
        payload = OllamaClient()._get_json("/api/tags", timeout_seconds=2)  # noqa: SLF001
        models = {
            str(entry.get("name") or entry.get("model") or "").strip().lower()
            for entry in payload.get("models", [])
            if isinstance(entry, dict)
        }
    except Exception:  # noqa: BLE001 — never let availability checks break a call
        models = set()
    if models:
        _MODEL_CACHE.update(ts=now, models=models)
    return _MODEL_CACHE.get("models") or set()  # type: ignore[return-value]


def _resolve_model(model: str) -> str:
    """Return ``model`` if Ollama has it installed; otherwise substitute a
    configured model that IS installed. This keeps the LLM working when a config
    or .env points at a model that was never pulled (e.g. summarize → qwen2.5:7b),
    instead of silently failing to the deterministic baseline every time."""
    available = _available_models()
    if not available:  # can't verify (offline / unreachable) — trust the config
        return model
    if model.strip().lower() in available:
        return model
    for candidate in (settings.llm_model_reasoning, settings.llm_model_fast, settings.llm_model):
        if candidate and candidate.strip().lower() in available:
            return candidate
    return sorted(available)[0]


def _model_for_task(task: LLMTask) -> str:
    if task in {"chat", "recommendation_explanation", "market_explanation"}:
        configured = settings.llm_model_reasoning or settings.llm_model or "qwen3:8b"
    elif task in {"asset_explanation", "market_signal_copy", "goal_estimate", "goal_clarify"}:
        configured = settings.llm_model_fast or settings.llm_model or "qwen3:8b"
    elif task == "summarize":
        configured = settings.llm_model_summarize or settings.llm_model_fast or settings.llm_model or "qwen3:8b"
    else:
        configured = settings.llm_model_extraction or settings.llm_model or "qwen3:8b"
    return _resolve_model(configured)


def _num_predict_for_task(task: LLMTask, expect_json: bool) -> int:
    if task == "chat":
        return 180
    if task == "summarize":
        return 80
    if task == "market_signal_copy":
        return 170
    if task == "market_explanation":
        return 150
    if task == "asset_explanation":
        return 180
    if task == "recommendation_explanation":
        return 210
    if task == "goal_estimate":
        return 160
    if task == "goal_clarify":
        # One clarifying question with a few options — a tight cap keeps the
        # onboarding round-trip fast.
        return 140
    return 520 if expect_json else 180


def _timeout_for_task(task: LLMTask) -> int:
    if task == "chat":
        return min(30, max(5, int(settings.llm_timeout_chat_seconds or 25)))
    if task in {"goal_estimate", "goal_clarify"}:
        # In the onboarding request path — keep it snappy and fall back fast.
        return min(15, max(5, int(settings.llm_timeout_chat_seconds or 12)))
    if task == "summarize":
        return min(10, max(3, int(settings.llm_timeout_summarize_seconds or 8)))
    if task in {"recommendation_explanation", "asset_explanation", "market_signal_copy", "market_explanation"}:
        # Background enhancement (not in the request path) — allow qwen3 enough time
        # to actually generate, so explanations don't always fall back to templates.
        return min(30, max(3, int(settings.llm_timeout_enhancement_seconds or 30)))
    return min(max(3, int(settings.llm_timeout_seconds or 25)), 10)


def _attempts_for_task(task: LLMTask) -> int:
    return 1


def _parse_json(text: str) -> Any:
    candidate = _json_candidate(text)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        repaired = _repair_json_candidate(candidate)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass
        extracted = _first_balanced_json_object(candidate)
        if extracted:
            return json.loads(_repair_json_candidate(extracted))
        raise LLMUnavailable("LLM did not return valid JSON.")


def _json_candidate(text: str) -> str:
    cleaned = str(text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        return cleaned[start : end + 1]
    return cleaned


def _repair_json_candidate(value: str) -> str:
    cleaned = re.sub(r",\s*([}\]])", r"\1", str(value or "").strip())
    open_curly = cleaned.count("{") - cleaned.count("}")
    open_square = cleaned.count("[") - cleaned.count("]")
    if open_square > 0:
        cleaned += "]" * open_square
    if open_curly > 0:
        cleaned += "}" * open_curly
    return cleaned


def _first_balanced_json_object(value: str) -> str | None:
    start = value.find("{")
    if start < 0:
        return None
    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(value[start:], start=start):
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_string:
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return value[start : index + 1]
    return None


def _strip_thinking(text: str) -> str:
    cleaned = str(text or "").strip()
    while "<think>" in cleaned and "</think>" in cleaned:
        before, _, remainder = cleaned.partition("<think>")
        _, _, after = remainder.partition("</think>")
        cleaned = f"{before}{after}".strip()
    return cleaned


def _valid_cards(value: Any, fallback_cards: list[dict[str, str]]) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return fallback_cards
    fallback_by_title = {item.get("title"): item for item in fallback_cards}
    cards = []
    for item in value:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "")
        if title not in fallback_by_title:
            continue
        cards.append(
            {
                "title": title,
                "summary": _safe_text(item.get("summary"), fallback_by_title[title].get("summary"), limit=190),
                "tone": item.get("tone") if item.get("tone") in {"good", "neutral", "warn"} else fallback_by_title[title].get("tone", "neutral"),
            }
        )
    return cards if len(cards) == len(fallback_cards) else fallback_cards


def _cards_from_answers(value: Any, fallback_cards: list[dict[str, str]]) -> list[dict[str, str]]:
    if not isinstance(value, list) or len(value) != len(fallback_cards):
        return fallback_cards
    cards = []
    for answer, fallback in zip(value, fallback_cards):
        cards.append(
            {
                "title": fallback.get("title", ""),
                "summary": _safe_text(answer, fallback.get("summary"), limit=190),
                "tone": fallback.get("tone", "neutral"),
            }
        )
    return cards


def _cards_from_short_payload(value: Any, fallback_cards: list[dict[str, str]]) -> list[dict[str, str]]:
    if not isinstance(value, dict):
        return fallback_cards
    keys = ["q", "n", "s", "x", "c"]
    if any(not str(value.get(key) or "").strip() for key in keys):
        return fallback_cards
    return [
        {
            "title": fallback.get("title", ""),
            "summary": _safe_text(value.get(key), fallback.get("summary"), limit=190),
            "tone": fallback.get("tone", "neutral"),
        }
        for key, fallback in zip(keys, fallback_cards)
    ]


def _compact_recommendation_context(recommendation: dict[str, Any]) -> dict[str, Any]:
    goal = (recommendation.get("linkedGoals") or [{}])[0]
    validation = recommendation.get("historicalValidation") or recommendation.get("validation") or {}
    benchmark = validation.get("benchmarkComparison") if isinstance(validation, dict) else {}
    regime_performance = validation.get("regimePerformance") if isinstance(validation, dict) else {}
    evidence = recommendation.get("evidencePoints") or recommendation.get("evidence") or []
    supporting = recommendation.get("supportingSignals") or []
    contradictory = recommendation.get("contradictorySignals") or []
    cluster = recommendation.get("investorCluster") or {}
    optimization = recommendation.get("portfolioOptimizationSummary") or {}
    return {
        "instrumentName": recommendation.get("instrumentName") or recommendation.get("assetName"),
        "assetType": recommendation.get("assetType") or recommendation.get("assetClass"),
        "action": recommendation.get("action"),
        "strategyBucket": recommendation.get("strategyBucket") or recommendation.get("recommendationType"),
        "riskLevel": recommendation.get("riskLevel"),
        "suggestedMonthlyAmount": recommendation.get("suggestedMonthlyAmount") or recommendation.get("suggestedAmount"),
        "suggestedAllocationPercentage": recommendation.get("suggestedAllocationPercentage") or recommendation.get("allocationPercent"),
        "allocationCap": recommendation.get("strictAllocationCap") or recommendation.get("allocationCap"),
        "expectedReturn": recommendation.get("expectedReturn") or recommendation.get("expectedReturnRange"),
        "reviewDate": recommendation.get("reviewDate"),
        "goal": {
            "name": goal.get("name") or recommendation.get("goalTag"),
            "priority": goal.get("priority") or recommendation.get("goalPriority") or recommendation.get("priorityOrder"),
            "timeline": recommendation.get("timeHorizon") or recommendation.get("longTermHorizon"),
            "fundingGap": goal.get("fundingGap") or recommendation.get("goalFundingGap"),
            "essential": goal.get("essential") or recommendation.get("essentialGoal"),
        },
        "userContext": {
            "riskProfile": cluster.get("riskProfile"),
            "investmentStyle": cluster.get("investmentStyle"),
            "liquidityNeed": cluster.get("liquidityNeed"),
            "volatilityTolerance": cluster.get("volatilityTolerance"),
            "monthlySurplus": optimization.get("monthlySurplus"),
        },
        "market": {
            "regime": recommendation.get("marketRegime"),
            "summary": recommendation.get("marketRegimeSummary"),
            "keyTrigger": recommendation.get("keyTrigger") or recommendation.get("conciseTrigger"),
        },
        "portfolio": {
            "role": recommendation.get("portfolioRole"),
            "bucket": recommendation.get("portfolioBucket"),
            "allocationImpact": recommendation.get("allocationImpact"),
            "concentrationRiskImpact": recommendation.get("concentrationRiskImpact"),
            "helpsDiversification": recommendation.get("helpsDiversification"),
        },
        "scores": {
            "confidence": recommendation.get("confidenceScore"),
            "conviction": recommendation.get("convictionScore"),
            "evidence": recommendation.get("evidenceScore"),
            "riskAdjusted": recommendation.get("riskAdjustedScore"),
            "technical": recommendation.get("technicalScore"),
            "fundamental": recommendation.get("fundamentalScore"),
            "validation": recommendation.get("validationScore"),
        },
        "evidence": _compact_evidence_items(evidence, 4),
        "supportingSignals": _compact_evidence_items(supporting, 3),
        "contradictorySignals": _compact_evidence_items(contradictory, 2),
        "risks": {
            "primary": recommendation.get("primaryRisk") or recommendation.get("whatCanGoWrong") or recommendation.get("riskExplanation"),
            "volatility": recommendation.get("volatilityWarning"),
            "concentration": recommendation.get("concentrationImpact"),
            "invalidation": recommendation.get("invalidationTrigger") or recommendation.get("exitOrRebalanceCondition"),
        },
        "validation": {
            "historicalReliability": validation.get("historicalReliability") if isinstance(validation, dict) else None,
            "setupQuality": validation.get("setupQuality") if isinstance(validation, dict) else None,
            "sampleSize": validation.get("sampleSize") if isinstance(validation, dict) else None,
            "maxDrawdown": validation.get("maxDrawdown") if isinstance(validation, dict) else None,
            "benchmarkNotes": benchmark.get("notes") if isinstance(benchmark, dict) else None,
            "bestRegime": regime_performance.get("bestRegime") if isinstance(regime_performance, dict) else None,
            "weakestRegime": regime_performance.get("weakestRegime") if isinstance(regime_performance, dict) else None,
        },
    }


def _compact_evidence_items(items: Any, limit: int) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        return []
    compacted = []
    for item in items[:limit]:
        if not isinstance(item, dict):
            continue
        compacted.append(
            {
                "source": item.get("source") or item.get("sourceName"),
                "signalType": item.get("signalType"),
                "confidence": item.get("confidence") or item.get("confidenceScore") or item.get("confidenceContribution"),
                "summary": _safe_text(item.get("summary"), "", limit=180),
                "timestamp": item.get("timestamp") or item.get("retrievedAt"),
            }
        )
    return compacted


def _snake_cards(cards: list[dict[str, str]]) -> list[dict[str, str]]:
    icon_map = {
        "Why am I seeing this?": "target",
        "Why could this be a good time?": "clock",
        "What makes this promising?": "check-circle",
        "What should I be careful about?": "alert-triangle",
        "What should I do next?": "compass",
    }
    return [
        {
            "question": item.get("title", ""),
            "answer": item.get("summary", ""),
            "icon": icon_map.get(item.get("title", ""), "info"),
            "tone": item.get("tone", "neutral"),
        }
        for item in cards
    ]


def _safe_list(value: Any, fallback: Any) -> list[str]:
    items = value if isinstance(value, list) else fallback if isinstance(fallback, list) else []
    return [_safe_text(item, "", limit=220) for item in items if _safe_text(item, "", limit=220)][:3]


def _safe_labels(value: Any, fallback: Any) -> list[str]:
    items = value if isinstance(value, list) else fallback if isinstance(fallback, list) else []
    labels = []
    for item in items:
        text = " ".join(str(item or "").split()).strip().rstrip(" .,:;")
        if text and text not in labels:
            labels.append(text[:80])
    return labels[:3]


def _safe_text(value: Any, fallback: Any, limit: int = 360) -> str:
    text = " ".join(str(value or fallback or "").replace("...", ".").split()).strip().rstrip(" ,;:")
    if not text:
        return ""
    if len(text) <= limit:
        return _complete_sentence(text)
    window = text[:limit]
    sentence_end = max(window.rfind(". "), window.rfind("? "), window.rfind("! "))
    if sentence_end >= 50:
        return _complete_sentence(window[: sentence_end + 1])
    words = window.split()
    return _complete_sentence(" ".join(words[:-1]))


def _looks_like_raw_market_data(value: Any) -> bool:
    text = str(value or "").lower()
    raw_markers = [
        "amfi nav record found",
        "latest nav in file",
        "api record found",
        "yahoo chart returned",
        "coingecko simple price data",
    ]
    return any(marker in text for marker in raw_markers)


def _safe_grounded_asset_text(value: Any, fallback: Any) -> str:
    text = str(value or "").lower()
    vague_markers = [
        "may benefit from market growth",
        "fits current market conditions",
        "aligns with market trends",
        "could support portfolio goals",
    ]
    return _safe_text(fallback if any(marker in text for marker in vague_markers) else value, fallback)


def _complete_sentence(value: str) -> str:
    text = value.strip().rstrip(" ,;:")
    return text if text[-1:] in ".!?" else f"{text}."


def _metadata(enhanced: bool, task: LLMTask, reason: str | None) -> dict[str, Any]:
    model = _model_for_task(task)
    generated_at = datetime.now(timezone.utc).isoformat()
    return {
        "llm_enhanced": enhanced,
        "llm_provider": settings.llm_provider if _enabled() else "none",
        "llm_model": model,
        "llm_generated_at": generated_at,
        "llm_fallback_reason": None if enhanced else reason or "llm_unavailable",
        "llmEnhanced": enhanced,
        "llmProvider": settings.llm_provider if _enabled() else "none",
        "llmModel": model,
        "llmGeneratedAt": generated_at,
        "llmFallbackReason": None if enhanced else reason or "llm_unavailable",
    }


def _fallback_reason(error: str) -> str:
    text = (error or "").lower()
    if "timed out" in text or "timeout" in text:
        return "ollama_timeout"
    if "json" in text:
        return "invalid_json"
    if "connection" in text or "refused" in text:
        return "ollama_unreachable"
    return "ollama_error" if text else "ollama_no_response"
