from __future__ import annotations

import hashlib
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from threading import Event, RLock
from typing import Any, Callable

from app.core.config import settings
from app.services.cache.intelligence_cache import get_cached, set_cached
from app.services.llm.batch_enhancement_service import (
    enhance_asset_intelligence_batch,
    enhance_market_signals_batch,
    enhance_recommendations_batch,
)
from app.services.llm.enhancement_persistence_service import (
    enhancement_status_snapshot,
    mark_processing,
    mark_queued,
    persist_result,
    persisted_overlay,
)
from app.services.llm.model_router import ollama_model_available, ollama_reachable

Enhancer = Callable[[list[dict[str, Any]], bool, int | None], list[dict[str, Any]]]
WorkItem = tuple[str, str, str, dict[str, Any]]

_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="llm-copy")
_LOCK = RLock()
_STOP = Event()
_PENDING: set[str] = set()
_STATS = {"queued": 0, "completed": 0, "fallback": 0}
logger = logging.getLogger("uvicorn.error")
COPY_QUALITY_VERSION = "ux-1c-personalized-reasoning-v3"


def hydrate_and_schedule_recommendations(items: list[dict[str, Any]], force: bool = False) -> list[dict[str, Any]]:
    return _hydrate_and_schedule("recommendation", items, enhance_recommendations_batch, force)


def hydrate_and_schedule_market_signals(items: list[dict[str, Any]], force: bool = False) -> list[dict[str, Any]]:
    return _hydrate_and_schedule("market", items, enhance_market_signals_batch, force)


def hydrate_and_schedule_assets(items: list[dict[str, Any]], force: bool = False) -> list[dict[str, Any]]:
    return _hydrate_and_schedule("asset", items, enhance_asset_intelligence_batch, force)


def enhancement_queue_status() -> dict[str, Any]:
    with _LOCK:
        return {
            **_STATS,
            "pending": len(_PENDING),
            "batchSize": max(1, settings.llm_batch_size),
            "workerCount": 1,
            "durable": enhancement_status_snapshot(),
        }


def shutdown_background_enhancements() -> None:
    _STOP.set()
    _EXECUTOR.shutdown(wait=False, cancel_futures=True)
    with _LOCK:
        _PENDING.clear()


def _hydrate_and_schedule(kind: str, items: list[dict[str, Any]], enhancer: Enhancer, force: bool) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    queued: list[WorkItem] = []
    for item in items:
        cache_key = _item_cache_key(kind, item)
        item_id = _item_id(kind, item)
        input_hash = _input_hash(kind, item)
        cached = get_cached("llm-enhancement", cache_key)
        persisted = persisted_overlay(kind, item_id, input_hash)
        hydrated = deepcopy(item)
        if isinstance(cached, dict):
            hydrated.update(deepcopy(cached))
        if isinstance(persisted, dict):
            hydrated.update(deepcopy(persisted))
        status = str(hydrated.get("llm_status") or hydrated.get("llm_enhancement_status") or "")
        attempts = int(hydrated.get("llm_attempt_count") or 0)
        should_schedule = force or persisted is None or not status or status in {"not_requested", "queued", "processing", "failed"} or (status == "fallback" and attempts < 2)
        if should_schedule:
            queued_metadata = mark_queued(kind, item_id, input_hash, _model(), force=force)
            hydrated.update(queued_metadata)
            queued.append((cache_key, item_id, input_hash, deepcopy(item)))
        output.append(hydrated)
    _schedule(kind, queued, enhancer)
    return output


def _schedule(kind: str, items: list[WorkItem], enhancer: Enhancer) -> None:
    work: list[WorkItem] = []
    with _LOCK:
        for cache_key, item_id, input_hash, item in items:
            pending_key = f"{kind}:{cache_key}"
            if pending_key in _PENDING:
                continue
            _PENDING.add(pending_key)
            _STATS["queued"] += 1
            work.append((pending_key, item_id, input_hash, item))
            logger.info("[LLM ENHANCEMENT QUEUED] item_type=%s item_id=%s model=%s", kind, item_id, _model())
    if work:
        _EXECUTOR.submit(_process, kind, work, enhancer)


def _process(kind: str, work: list[WorkItem], enhancer: Enhancer) -> None:
    batch_size = max(1, settings.llm_batch_size)
    reachable = ollama_reachable()
    model_available = reachable and ollama_model_available()
    for start in range(0, len(work), batch_size):
        if _STOP.is_set():
            break
        chunk = work[start : start + batch_size]
        for work_item in chunk:
            if _STOP.is_set():
                break
            _process_item(kind, work_item, enhancer, reachable, model_available)


def _process_item(kind: str, work_item: WorkItem, enhancer: Enhancer, reachable: bool, model_available: bool) -> None:
    pending_key, item_id, input_hash, item = work_item
    started = time.perf_counter()
    mark_processing(kind, item_id, input_hash, _model())
    logger.info("[LLM ENHANCEMENT STARTED] item_type=%s item_id=%s model=%s", kind, item_id, _model())
    try:
        results = enhancer([deepcopy(item)], True, 1) if model_available else []
    except Exception:
        results = []
    if len(results) != 1:
        reason = "ollama_error" if model_available else "ollama_model_unavailable" if reachable else "ollama_unreachable"
        result = {**item, **_fallback_metadata(reason)}
    else:
        result = results[0]
    enhanced = bool(result.get("llm_enhanced") or result.get("llmEnhanced"))
    duration_ms = round((time.perf_counter() - started) * 1000)
    result.update(_completed_metadata(enhanced))
    persisted = persist_result(kind, item_id, input_hash, result, duration_ms)
    result.update(persisted)
    cache_key = pending_key.split(":", 1)[1]
    set_cached("llm-enhancement", cache_key, result, ttl_seconds=3600 if enhanced else 300)
    fallback_reason = result.get("llm_fallback_reason") or result.get("llmFallbackReason")
    logger.info(
        "[LLM ENHANCEMENT %s] item_type=%s item_id=%s model=%s duration_ms=%s fallback_reason=%s",
        "COMPLETED" if enhanced else "FAILED",
        kind,
        item_id,
        _model(),
        duration_ms,
        fallback_reason or "none",
    )
    with _LOCK:
        _PENDING.discard(pending_key)
        _STATS["completed"] += 1
        if not enhanced:
            _STATS["fallback"] += 1
    if fallback_reason == "ollama_timeout":
        time.sleep(2)


def _item_cache_key(kind: str, item: dict[str, Any]) -> str:
    digest = _input_hash(kind, item)[:24]
    return f"{kind}-{digest}"


def _item_id(kind: str, item: dict[str, Any]) -> str:
    if kind == "recommendation":
        return str(item.get("recommendationKey") or item.get("id") or item.get("instrumentName") or "unknown")
    if kind == "market":
        return str(item.get("id") or item.get("sourceUrl") or "unknown")
    return str(item.get("ticker") or item.get("assetName") or item.get("instrumentName") or "unknown")


def _input_hash(kind: str, item: dict[str, Any]) -> str:
    identity = {
        "itemType": kind,
        "copyQualityVersion": COPY_QUALITY_VERSION,
        "id": _item_id(kind, item),
        "timestamp": item.get("dataTimestamp") or item.get("lastResearchedAt") or item.get("retrievedAt"),
        "version": item.get("versionNumber"),
        "evidence": item.get("evidenceScore") or item.get("evidenceCount"),
        "confidence": item.get("convictionScore") or item.get("confidenceScore"),
    }
    return hashlib.sha256(json.dumps(identity, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def _completed_metadata(enhanced: bool) -> dict[str, Any]:
    return {
        "llm_status": "completed" if enhanced else "fallback",
        "llm_enhancement_status": "completed" if enhanced else "fallback",
        "llm_enhancement_pending": False,
        "llmEnhancementStatus": "completed" if enhanced else "fallback",
        "llmEnhancementPending": False,
    }


def _fallback_metadata(reason: str) -> dict[str, Any]:
    model = settings.llm_model_fast or settings.llm_model
    return {
        "llm_enhanced": False,
        "llm_provider": settings.llm_provider if settings.llm_enabled else "none",
        "llm_model": model,
        "llm_fallback_reason": reason,
        "llm_last_error": reason,
        "llmEnhanced": False,
        "llmProvider": settings.llm_provider if settings.llm_enabled else "none",
        "llmModel": model,
        "llmFallbackReason": reason,
    }


def _model() -> str:
    return settings.llm_model_fast or settings.llm_model
