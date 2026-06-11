from __future__ import annotations

import hashlib
import time
from typing import Any


_CACHE: dict[str, tuple[float, Any]] = {}


def make_llm_cache_key(task: str, model: str, prompt: str) -> str:
    digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:24]
    return f"{task}:{model}:{digest}"


def get_llm_cache(key: str) -> Any | None:
    item = _CACHE.get(key)
    if not item:
        return None
    expires_at, value = item
    if expires_at < time.time():
        _CACHE.pop(key, None)
        return None
    return value


def set_llm_cache(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    _CACHE[key] = (time.time() + ttl_seconds, value)
