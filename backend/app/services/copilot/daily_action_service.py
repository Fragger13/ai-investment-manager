from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents.goal_impact_agent import attach_goal_impacts
from app.models.asset_research import AssetResearch
from app.models.market_signal import MarketSignal
from app.models.recommendation import RecommendationRecord
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import build_dashboard, now_iso
from app.services.optimization.portfolio_optimizer import optimize_portfolio
from app.services.recommendations.suitability_scoring_service import build_profile_context


def build_financial_copilot(
    db: Session,
    profile: OnboardingProfile,
    *,
    dashboard: dict[str, Any] | None = None,
    portfolio: dict[str, Any] | None = None,
    recommendations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    dashboard = dashboard or build_dashboard(profile)
    portfolio = portfolio or optimize_portfolio(db, profile, persist=False)
    recommendations = recommendations if recommendations is not None else _latest_recommendations(db)
    recommendations = [attach_goal_impacts(dict(item)) for item in recommendations]
    context = build_profile_context(profile)
    actions = _priority_actions(dashboard, portfolio, recommendations, context)
    opportunities = _opportunity_radar(db, recommendations)
    weekly_score = _weekly_health_score(dashboard, portfolio)
    cashflow = _cashflow_coach(dashboard, context, actions)
    signals = _latest_market_signals(db)
    brief_items = _brief_items(dashboard, portfolio, opportunities, signals, context)
    return {
        "greeting": _greeting(profile.name),
        "intro": "Here are the most important things to review today.",
        "briefItems": brief_items,
        "recommendedAction": actions[0] if actions else _hold_action(),
        "priorityActions": actions,
        "emergingOpportunities": opportunities,
        "goalImpacts": {
            str(item.get("recommendationKey") or item.get("id") or item.get("instrumentName")): item.get("goalImpacts", [])
            for item in recommendations
        },
        "portfolioDrift": _portfolio_drift_summary(portfolio),
        "cashflowCoach": cashflow,
        "weeklyHealth": weekly_score,
        "generatedAt": now_iso(),
        "disclaimer": "This is educational decision support, not a promise of returns. Review suitability and sources before acting.",
    }


def _priority_actions(dashboard: dict[str, Any], portfolio: dict[str, Any], recommendations: list[dict[str, Any]], context) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    if context.emergency_gap > 0:
        actions.append(
            _action(
                "High",
                "Invest",
                "Build emergency savings first",
                f"Your emergency savings are short by about Rs {context.emergency_gap:,.0f}. Set this aside before adding higher-risk ideas.",
                min(context.emergency_gap, round(context.surplus * 0.6)),
                "Emergency fund",
                "cashflow",
            )
        )

    for item in portfolio.get("rebalancingSuggestions", [])[:3]:
        action_type = "Reduce" if item.get("action") == "trim" else "Rebalance"
        priority = "High" if item.get("priority") == 1 or abs(item.get("driftPercentage", 0)) >= 10 else "Medium"
        actions.append(
            _action(
                priority,
                action_type,
                item.get("title", "Review your investment mix"),
                item.get("explanation", "Use new monthly savings to move closer to your plan."),
                int(item.get("monthlyAmount") or 0),
                _first_linked_goal(portfolio, item.get("bucketKey")),
                "portfolio",
            )
        )

    goals = sorted(dashboard.get("goals", []), key=lambda goal: (goal.get("feasibilityScore", 100), goal.get("priority", 99)))
    for goal in goals[:2]:
        if goal.get("feasibilityScore", 100) >= 70:
            continue
        actions.append(
            _action(
                "High" if goal.get("priority", 99) <= 2 else "Medium",
                "Invest",
                f"Increase funding for {goal.get('name', 'your goal')}",
                f"This goal is currently {goal.get('feasibilityScore', 0)}% achievable based on the saved plan. Prioritize it before optional ideas.",
                int(goal.get("requiredMonthlyInvestment") or 0),
                goal.get("name", ""),
                "goal",
            )
        )

    if context.savings_rate < 20:
        shortfall = max(round(context.income * 0.2 - context.surplus), 0)
        actions.append(
            _action(
                "High",
                "Reduce",
                "Free up more monthly savings",
                "Your savings rate is below the 20% planning level. Review one flexible expense before increasing investment risk.",
                shortfall,
                "",
                "cashflow",
            )
        )

    for rec in recommendations[:4]:
        title = rec.get("instrumentName") or rec.get("recommendationTitle")
        if not title:
            continue
        watchlist = str(rec.get("action", "")).lower() == "watchlist" or rec.get("surfaceGroup") == "Watchlist"
        actions.append(
            _action(
                "Low" if watchlist else "Medium",
                "Monitor" if watchlist else "Invest",
                f"{'Keep an eye on' if watchlist else 'Consider adding'} {title}",
                rec.get("conciseReason") or rec.get("whyThisMatters") or "Review the supporting information before acting.",
                int(rec.get("suggestedMonthlyAmount") or 0),
                rec.get("goalTag", ""),
                "recommendation",
                str(rec.get("recommendationKey") or rec.get("id") or title),
            )
        )

    return _dedupe_actions(actions)[:7] or [_hold_action()]


def _opportunity_radar(db: Session, recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    radar = []
    for rec in recommendations:
        opportunity_type = _opportunity_type(rec)
        if not opportunity_type:
            continue
        radar.append(
            {
                "assetName": rec.get("instrumentName", "Investment idea"),
                "ticker": rec.get("ticker", ""),
                "assetType": rec.get("assetType", ""),
                "opportunityType": opportunity_type,
                "confidenceScore": int(rec.get("convictionScore") or rec.get("confidenceScore") or 0),
                "expectedReturn": (rec.get("expectedReturn") or {}).get("label", "Estimate pending"),
                "riskLevel": rec.get("riskLevel", "Medium"),
                "supportingSignals": _supporting_signals(rec),
                "linkedGoal": rec.get("goalTag", ""),
                "whyItMatters": rec.get("conciseReason") or rec.get("whyThisMatters") or "",
                "action": rec.get("action", "Watchlist"),
            }
        )
    if len(radar) < 3:
        radar.extend(_asset_research_opportunities(db, {item["assetName"] for item in radar}))
    return sorted(radar, key=lambda item: item.get("confidenceScore", 0), reverse=True)[:5]


def _brief_items(dashboard: dict[str, Any], portfolio: dict[str, Any], opportunities: list[dict[str, Any]], signals: list[dict[str, Any]], context) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    goals = sorted(dashboard.get("goals", []), key=lambda goal: goal.get("priority", 99))
    if goals:
        top_goal = goals[0]
        on_track = top_goal.get("feasibilityScore", 0) >= 70
        items.append({"tone": "positive" if on_track else "warning", "text": f"{top_goal.get('name')} is {'on track' if on_track else 'falling behind the current plan'}."})
    if context.emergency_gap > 0:
        items.append({"tone": "warning", "text": f"Emergency savings are short by about Rs {context.emergency_gap:,.0f}."})
    else:
        items.append({"tone": "positive", "text": "Emergency savings are at or above the suggested level."})
    if opportunities:
        items.append({"tone": "opportunity", "text": f"A new idea worth reviewing is {opportunities[0]['assetName']}."})
    if signals:
        items.append({"tone": "market", "text": signals[0]["summary"]})
    drift = portfolio.get("summary", {}).get("allocationDrift", 0)
    if drift >= 20:
        items.append({"tone": "warning", "text": f"Your investment mix is about {drift} percentage points away from the suggested plan."})
    return items[:5]


def _cashflow_coach(dashboard: dict[str, Any], context, actions: list[dict[str, Any]]) -> dict[str, Any]:
    if context.emergency_gap > 0:
        amount = min(context.emergency_gap, round(context.surplus * 0.6))
        return {"title": "One thing you can do this month", "action": "Build emergency savings", "amount": amount, "detail": f"Set aside about Rs {amount:,.0f} before adding higher-risk investments."}
    if context.savings_rate < 20:
        amount = max(round(context.income * 0.2 - context.surplus), 0)
        return {"title": "One thing you can do this month", "action": "Reduce flexible spending", "amount": amount, "detail": f"Try freeing up about Rs {amount:,.0f} so more of your income can support your goals."}
    next_invest = next((item for item in actions if item["actionType"] in {"Invest", "Rebalance"} and item["amount"] > 0), None)
    if next_invest:
        return {"title": "One thing you can do this month", "action": next_invest["title"], "amount": next_invest["amount"], "detail": next_invest["detail"]}
    return {"title": "One thing you can do this month", "action": "Stay consistent", "amount": 0, "detail": "Keep your existing monthly plan and review it again after the next profile update."}


def _weekly_health_score(dashboard: dict[str, Any], portfolio: dict[str, Any]) -> dict[str, Any]:
    summary = portfolio.get("summary", {})
    components = [
        {"label": "Goal progress", "score": _average([goal.get("feasibilityScore", 0) for goal in dashboard.get("goals", [])], 60)},
        {"label": "Savings discipline", "score": min(100, round(dashboard.get("summary", {}).get("savingsRate", 0) * 3.3))},
        {"label": "Investment plan health", "score": int(summary.get("portfolioHealth", 0))},
        {"label": "How well your money is spread out", "score": int(summary.get("diversificationScore", 0))},
        {"label": "Risk alignment", "score": max(0, 100 - int(summary.get("volatilityScore", 0)))},
    ]
    score = _average([item["score"] for item in components], 0)
    return {
        "score": score,
        "trend": "Improving" if score >= 72 else "Stable" if score >= 52 else "Needs attention",
        "components": components,
        "improvementSuggestions": _health_suggestions(dashboard, portfolio),
    }


def _portfolio_drift_summary(portfolio: dict[str, Any]) -> dict[str, Any]:
    summary = portfolio.get("summary", {})
    return {
        "allocationDrift": summary.get("allocationDrift", 0),
        "concentrationScore": summary.get("concentrationScore", 0),
        "riskExposure": summary.get("riskExposure", "Unknown"),
        "topAction": summary.get("topRebalancingAction", "No immediate adjustment is needed."),
        "warnings": portfolio.get("riskWarnings", [])[:4],
    }


def _latest_recommendations(db: Session) -> list[dict[str, Any]]:
    rows = db.query(RecommendationRecord).order_by(RecommendationRecord.id.desc()).limit(100).all()
    parsed = []
    for row in rows:
        try:
            item = json.loads(row.recommendation_data)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if item.get("recommendationTitle"):
            parsed.append(item)
    if not parsed:
        return []
    timestamp = parsed[0].get("dataTimestamp", "")
    latest = [item for item in parsed if item.get("dataTimestamp") == timestamp]
    return sorted(latest, key=lambda item: item.get("priorityOrder", 999))[:15]


def _latest_market_signals(db: Session) -> list[dict[str, Any]]:
    rows = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(4).all()
    return [{"summary": row.summary, "confidenceScore": row.confidence_score} for row in rows]


def _asset_research_opportunities(db: Session, seen: set[str]) -> list[dict[str, Any]]:
    rows = db.query(AssetResearch).order_by(AssetResearch.confidence_score.desc(), AssetResearch.id.desc()).limit(12).all()
    output = []
    for row in rows:
        if row.instrument_name in seen:
            continue
        output.append(
            {
                "assetName": row.instrument_name,
                "ticker": "",
                "assetType": row.asset_type,
                "opportunityType": "Emerging opportunity",
                "confidenceScore": row.confidence_score,
                "expectedReturn": "Estimate pending",
                "riskLevel": "Review needed",
                "supportingSignals": [row.summary],
                "linkedGoal": "",
                "whyItMatters": row.suitability_notes or row.summary,
                "action": "Watchlist",
            }
        )
        if len(output) >= 3:
            break
    return output


def _action(priority: str, action_type: str, title: str, detail: str, amount: int, linked_goal: str, source: str, entity_id: str = "") -> dict[str, Any]:
    return {"priority": priority, "actionType": action_type, "title": title, "detail": detail, "amount": max(amount, 0), "linkedGoal": linked_goal, "source": source, "entityId": entity_id}


def _hold_action() -> dict[str, Any]:
    return _action("Low", "Hold", "Stay consistent with your current plan", "No urgent change is needed today. Keep your monthly plan and review it after the next update.", 0, "", "copilot")


def _dedupe_actions(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    priority_order = {"High": 0, "Medium": 1, "Low": 2}
    output = []
    seen = set()
    for item in sorted(actions, key=lambda row: priority_order.get(row["priority"], 3)):
        key = (item["actionType"], item["title"].lower())
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def _opportunity_type(rec: dict[str, Any]) -> str:
    bucket = str(rec.get("strategyBucket") or "")
    recommendation_type = str(rec.get("recommendationType") or "")
    if rec.get("convictionScore", 0) >= 78:
        return "Strong opportunity"
    if bucket in {"Underdog", "Event-driven"} or recommendation_type in {"Underdog", "Event-driven"}:
        return "Emerging opportunity"
    if bucket == "Tactical" or rec.get("assetIntelligenceBacked"):
        return "Early trend"
    return ""


def _supporting_signals(rec: dict[str, Any]) -> list[str]:
    signals = [item.get("summary", "") for item in rec.get("evidencePoints", []) if item.get("summary")]
    if not signals:
        signals = [rec.get("conciseReason") or rec.get("whyThisMatters") or "Review the supporting information before acting."]
    return signals[:3]


def _first_linked_goal(portfolio: dict[str, Any], bucket_key: str | None) -> str:
    bucket = next((item for item in portfolio.get("bucketAllocations", []) if item.get("bucketKey") == bucket_key), {})
    return (bucket.get("linkedGoals") or [{}])[0].get("name", "")


def _health_suggestions(dashboard: dict[str, Any], portfolio: dict[str, Any]) -> list[str]:
    suggestions = list(dashboard.get("health", {}).get("actions", []))[:2]
    suggestions.extend(portfolio.get("riskWarnings", [])[:2])
    return suggestions[:3] or ["Keep your profile updated and review this plan once a month."]


def _average(values: list[int | float], fallback: int) -> int:
    return round(sum(values) / len(values)) if values else fallback


def _greeting(name: str) -> str:
    hour = datetime.now().hour
    greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"
    return f"{greeting}{f' {name}' if name else ''}"
