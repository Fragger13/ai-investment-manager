from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

from app.services.cache.intelligence_cache import cache_status


def readiness_snapshot() -> dict[str, Any]:
    """Production-readiness metadata without requiring external infra."""

    configured_keys = [
        "ALPHA_VANTAGE_API_KEY",
        "TWELVE_DATA_API_KEY",
        "NEWS_API_KEY",
        "COINGECKO_API_KEY",
        "OPENAI_API_KEY",
    ]
    return {
        "status": "ready",
        "timestamp": datetime.now(UTC).isoformat(timespec="seconds"),
        "cache": cache_status(),
        "taskQueue": {
            "backend": "synchronous-fallback",
            "asyncReady": True,
        },
        "observability": {
            "structuredLoggingReady": True,
            "healthChecks": ["/health", "/api/v1/system/readiness"],
            "rateLimitHookReady": True,
            "timeoutRetryHookReady": True,
        },
        "environment": {
            "configuredOptionalKeys": [key for key in configured_keys if os.getenv(key)],
            "missingOptionalKeys": [key for key in configured_keys if not os.getenv(key)],
        },
    }
