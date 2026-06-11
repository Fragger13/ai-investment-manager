from __future__ import annotations

from typing import Any


def assemble_chat_context(raw: dict[str, Any]) -> dict[str, Any]:
    recommendations = raw.get("recommendations", [])
    portfolio = raw.get("portfolio", {})
    dashboard = raw.get("dashboard", {})
    market = raw.get("market", {})
    memory = raw.get("memory", {})
    copilot = raw.get("copilot", {})
    return {
        **raw,
        "topRecommendation": _top_recommendation(recommendations),
        "tacticalIdeas": [rec for rec in recommendations if rec.get("surfaceGroup") == "Tactical Opportunities" or rec.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven"}][:4],
        "watchlistIdeas": [rec for rec in recommendations if str(rec.get("action", "")).lower() == "watchlist" or rec.get("surfaceGroup") == "Watchlist"][:4],
        "keyRisks": _key_risks(dashboard, portfolio, memory),
        "underfundedGoals": sorted(dashboard.get("goals", []), key=lambda goal: goal.get("feasibilityScore", 100))[:3],
        "importantSignals": sorted(market.get("signals", []), key=lambda signal: signal.get("impactScore", signal.get("confidenceScore", 0)), reverse=True)[:5],
        "priorityActions": copilot.get("priorityActions", [])[:5],
        "weeklyHealth": copilot.get("weeklyHealth", {}),
        "cashflowCoach": copilot.get("cashflowCoach", {}),
    }


def _top_recommendation(recommendations: list[dict[str, Any]]) -> dict[str, Any]:
    if not recommendations:
        return {}
    return sorted(recommendations, key=lambda rec: (rec.get("importanceScore", 0), rec.get("convictionScore", 0)), reverse=True)[0]


def _key_risks(dashboard: dict[str, Any], portfolio: dict[str, Any], memory: dict[str, Any]) -> list[str]:
    risks = []
    risks.extend(dashboard.get("alerts", [])[:3])
    risks.extend(portfolio.get("riskWarnings", [])[:3])
    risks.extend(alert.get("summary", "") for alert in memory.get("driftAlerts", [])[:3])
    return [risk for risk in risks if risk][:5]
