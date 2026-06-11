from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.asset_research import AssetResearch
from app.models.drift_alert import DriftAlert
from app.models.market_signal import MarketSignal
from app.models.recommendation import RecommendationRecord
from app.services.alerts import list_alerts
from app.services.llm_usage import llm_usage_snapshot
from app.services.profile_resolution import latest_profile_metadata


def app_health_snapshot(db: Session) -> dict[str, Any]:
    database_connected = _database_connected(db)
    profile = latest_profile_metadata(db) if database_connected else {"exists": False, "hasData": False, "goalsCount": 0}
    return {
        "databaseConnected": database_connected,
        "environment": settings.environment,
        "currentUserResolved": False,
        "currentUserResolution": "Debug endpoint is unauthenticated; API falls back to latest saved local profile in dev mode.",
        "onboardingProfileExists": profile["exists"],
        "latestProfileHasData": profile["hasData"],
        "goalsCount": profile["goalsCount"],
        "recommendationsCount": _safe_count(db, RecommendationRecord),
        "marketSignalsCount": _safe_count(db, MarketSignal),
        "assetIntelligenceCount": _safe_count(db, AssetResearch),
        "alertsCount": len(list_alerts()) + _safe_open_alert_count(db),
        "llm": _llm_summary(),
    }


def _database_connected(db: Session) -> bool:
    try:
        db.execute(text("select 1"))
        return True
    except Exception:
        return False


def _safe_count(db: Session, model: Any) -> int:
    try:
        return db.query(model).count()
    except Exception:
        return 0


def _safe_open_alert_count(db: Session) -> int:
    try:
        return db.query(DriftAlert).filter(DriftAlert.status == "open").count()
    except Exception:
        return 0


def _llm_summary() -> dict[str, Any]:
    usage = llm_usage_snapshot()
    return {
        "provider": usage.get("provider"),
        "model": usage.get("model"),
        "llmEnabled": usage.get("llmEnabled"),
        "aiMode": usage.get("aiMode"),
        "ollamaReachable": usage.get("ollamaReachable"),
    }
