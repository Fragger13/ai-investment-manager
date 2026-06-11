from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.asset_research import AssetResearch
from app.models.market_signal import MarketSignal
from app.models.recommendation import RecommendationRecord
from app.schemas.financial import OnboardingProfile
from app.services.chat.chat_memory_service import recent_chat_messages
from app.services.copilot.daily_action_service import build_financial_copilot
from app.services.intelligence import build_dashboard
from app.services.market.signal_intelligence_service import latest_market_regime
from app.services.memory.adaptive_memory_service import memory_context
from app.services.optimization.portfolio_optimizer import optimize_portfolio


def build_chat_context(db: Session, profile: OnboardingProfile) -> dict[str, Any]:
    dashboard = build_dashboard(profile)
    recommendations = _latest_recommendations(db)
    portfolio = optimize_portfolio(db, profile, persist=False)
    market_signals = _latest_market_signals(db)
    copilot = build_financial_copilot(
        db,
        profile,
        dashboard=dashboard,
        portfolio=portfolio,
        recommendations=recommendations,
    )
    return {
        "profile": _profile_summary(profile, dashboard),
        "dashboard": dashboard,
        "recommendations": recommendations,
        "market": {
            "regime": latest_market_regime(db),
            "signals": market_signals,
        },
        "portfolio": portfolio,
        "memory": memory_context(db),
        "recentChat": recent_chat_messages(db),
        "assetIntelligence": _latest_asset_intelligence(db),
        "copilot": copilot,
    }


def _latest_recommendations(db: Session) -> list[dict[str, Any]]:
    rows = db.query(RecommendationRecord).order_by(RecommendationRecord.id.desc()).limit(80).all()
    parsed = []
    for row in rows:
        try:
            data = json.loads(row.recommendation_data)
        except json.JSONDecodeError:
            continue
        if data.get("recommendationTitle"):
            parsed.append(data)
    if not parsed:
        return []
    latest_timestamp = parsed[0].get("dataTimestamp", "")
    latest = [item for item in parsed if item.get("dataTimestamp") == latest_timestamp]
    return sorted(latest, key=lambda item: item.get("priorityOrder", 999))[:12]


def _profile_summary(profile: OnboardingProfile, dashboard: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": profile.name,
        "age": profile.age,
        "riskProfile": dashboard.get("summary", {}).get("riskProfile", ""),
        "monthlyIncome": dashboard.get("summary", {}).get("monthlyIncome", 0),
        "monthlyExpenses": dashboard.get("summary", {}).get("monthlyExpenses", 0),
        "monthlySurplus": dashboard.get("summary", {}).get("investableSurplus", 0),
        "savingsRate": dashboard.get("summary", {}).get("savingsRate", 0),
        "goals": [
            {
                "name": goal.get("name"),
                "priority": goal.get("priority"),
                "targetAmount": goal.get("targetAmount"),
                "requiredMonthlyInvestment": goal.get("requiredMonthlyInvestment"),
                "feasibilityScore": goal.get("feasibilityScore"),
            }
            for goal in dashboard.get("goals", [])
        ],
    }


def _latest_asset_intelligence(db: Session) -> list[dict[str, Any]]:
    rows = db.query(AssetResearch).order_by(AssetResearch.id.desc()).limit(12).all()
    output = []
    seen: set[str] = set()
    for row in rows:
        if row.instrument_name in seen:
            continue
        seen.add(row.instrument_name)
        output.append(
            {
                "assetName": row.instrument_name,
                "assetType": row.asset_type,
                "summary": row.summary,
                "confidenceScore": row.confidence_score,
                "dataMode": row.data_mode,
                "retrievedAt": row.retrieved_at,
            }
        )
    return output[:6]


def _latest_market_signals(db: Session) -> list[dict[str, Any]]:
    rows = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(8).all()
    return [
        {
            "id": row.id,
            "title": row.summary[:90],
            "summary": row.summary,
            "signalType": row.signal_type,
            "sentiment": row.sentiment,
            "confidenceScore": row.confidence_score,
            "sourceName": row.source_name,
            "retrievedAt": row.retrieved_at,
            "whyItMatters": row.summary[:180],
        }
        for row in rows
    ]
