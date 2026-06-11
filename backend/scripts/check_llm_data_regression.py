from __future__ import annotations

from app.core.config import settings
from app.core.database import SessionLocal
from app.agents.recommendation_action_agent import generate_advanced_recommendations
from app.services.assets.asset_intelligence_service import asset_research
from app.services.intelligence import build_dashboard
from app.services.market.signal_intelligence_service import market_signal_list
from app.services.memory.adaptive_memory_service import drift_alerts
from app.services.profile_resolution import resolve_profile


def main() -> None:
    db = SessionLocal()
    try:
        _check_core_data(db, "llm-current")

        original_enabled = settings.llm_enabled
        settings.llm_enabled = False
        try:
            _check_core_data(db, "llm-disabled")
        finally:
            settings.llm_enabled = original_enabled
    finally:
        db.close()

    print("LLM data regression checks passed.")


def _check_core_data(db, label: str) -> None:
    profile = resolve_profile(db, None)
    dashboard = build_dashboard(profile)
    assert dashboard["summary"]["monthlyIncome"] > 0, f"{label}: dashboard income should not be zero"
    assert len(dashboard["goals"]) > 0, f"{label}: goals should load"

    recommendations = generate_advanced_recommendations(profile, db)
    assert len(recommendations.get("recommendations", [])) > 0, f"{label}: recommendations should load"

    market = market_signal_list(db, limit=8)
    assert len(market) > 0, f"{label}: market signals should load"

    assets = asset_research(db)
    assert len(assets) > 0, f"{label}: asset intelligence should load"

    alerts = drift_alerts(db)
    assert isinstance(alerts, list), f"{label}: alerts should return a list"


if __name__ == "__main__":
    main()
