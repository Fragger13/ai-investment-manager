from __future__ import annotations

import logging
from collections import deque
from typing import Any

logger = logging.getLogger("uvicorn.error")
_EVENTS: deque[dict[str, Any]] = deque(maxlen=50)


def record_llm_event(event: dict[str, Any]) -> None:
    safe = {key: value for key, value in event.items() if "key" not in key.lower() and "secret" not in key.lower()}
    _EVENTS.append(safe)
    logger.info(
        "[LLM CALL] %s provider=%s model=%s latency_ms=%s fallback=%s",
        _public_task_name(str(safe.get("task") or "unknown")),
        safe.get("provider"),
        safe.get("model"),
        safe.get("elapsedMs"),
        "yes" if safe.get("fallback") else "no",
    )
    logger.info(
        "LLM event task=%s provider=%s model=%s ok=%s fallback=%s elapsed_ms=%s",
        safe.get("task"),
        safe.get("provider"),
        safe.get("model"),
        safe.get("ok"),
        safe.get("fallback"),
        safe.get("elapsedMs"),
    )


def recent_llm_events() -> list[dict[str, Any]]:
    return list(_EVENTS)


def _public_task_name(task: str) -> str:
    mapping = {
        "recommendation_explanation": "recommendation_explanation",
        "market_signal_copy": "market_summary",
        "market_explanation": "market_summary",
        "asset_explanation": "asset_summary",
        "chat": "chat",
    }
    return mapping.get(task, task)
