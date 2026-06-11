from __future__ import annotations

import hashlib
import json
import time
from threading import RLock
from typing import Any


class IntelligenceCache:
    """Small Redis-ready cache facade with an in-memory fallback."""

    def __init__(self) -> None:
        self._items: dict[str, tuple[float, Any]] = {}
        self._lock = RLock()

    def get(self, key: str) -> Any | None:
        now = time.time()
        with self._lock:
            row = self._items.get(key)
            if not row:
                return None
            expires_at, value = row
            if expires_at <= now:
                self._items.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        with self._lock:
            self._items[key] = (time.time() + max(1, ttl_seconds), value)

    def clear_namespace(self, namespace: str) -> int:
        prefix = f"{namespace}:"
        with self._lock:
            keys = [key for key in self._items if key.startswith(prefix)]
            for key in keys:
                self._items.pop(key, None)
            return len(keys)

    def status(self) -> dict[str, Any]:
        now = time.time()
        with self._lock:
            live_keys = [key for key, (expires_at, _) in self._items.items() if expires_at > now]
            expired = len(self._items) - len(live_keys)
            return {
                "backend": "memory",
                "liveEntries": len(live_keys),
                "expiredEntries": expired,
                "redisReady": True,
            }


_CACHE = IntelligenceCache()


def make_cache_key(namespace: str, payload: Any) -> str:
    normalized = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
    return f"{namespace}-{digest}"


def get_cached(namespace: str, key: str) -> Any | None:
    return _CACHE.get(f"{namespace}:{key}")


def set_cached(namespace: str, key: str, value: Any, ttl_seconds: int = 300) -> None:
    _CACHE.set(f"{namespace}:{key}", value, ttl_seconds)


def clear_cache_namespace(namespace: str) -> int:
    return _CACHE.clear_namespace(namespace)


def cache_status() -> dict[str, Any]:
    return _CACHE.status()
