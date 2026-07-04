from __future__ import annotations

import json
from hashlib import sha1
from typing import Any

from sqlalchemy.orm import Session

from app.models.behavioral_snapshot import BehavioralSnapshot
from app.models.drift_alert import DriftAlert
from app.models.financial_memory_event import FinancialMemoryEvent
from app.models.goal_snapshot import GoalSnapshot
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.recommendation import RecommendationRecord
from app.models.recommendation_outcome import RecommendationOutcome
from app.models.recommendation_reassessment_log import RecommendationReassessmentLog
from app.models.recommendation_version import RecommendationVersion
from app.models.user_action_event import UserActionEvent
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import calculated_goal_target, computed_monthly_surplus, monthly_income, months_until, net_worth, now_iso, profile_to_dict, total_emi_payments
from app.services.market.signal_intelligence_service import latest_market_regime
from app.services.optimization.portfolio_optimizer import latest_optimization, optimize_portfolio


def recommendation_key(recommendation: dict) -> str:
    raw = "|".join(
        [
            str(recommendation.get("instrumentName") or recommendation.get("assetName") or ""),
            str(recommendation.get("ticker") or ""),
            str(recommendation.get("assetType") or recommendation.get("assetClass") or ""),
            str(recommendation.get("goalTag") or recommendation.get("linkedGoals", [{}])[0].get("name", "")),
        ]
    ).lower()
    return sha1(raw.encode("utf-8")).hexdigest()[:16]


def record_memory_event(
    db: Session,
    event_type: str,
    category: str,
    title: str,
    summary: str,
    *,
    payload: dict | None = None,
    entity_type: str = "",
    entity_id: str = "",
    severity: str = "info",
    user_id: int | None = None,
) -> dict:
    created_at = now_iso()
    row = FinancialMemoryEvent(
        user_id=user_id,
        event_type=event_type,
        category=category,
        title=title,
        summary=summary,
        entity_type=entity_type,
        entity_id=entity_id,
        severity=severity,
        payload_json=json.dumps(payload or {}),
        created_at=created_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _event_payload(row)


def snapshot_profile(db: Session, profile: OnboardingProfile, source: str = "profile_update") -> dict:
    profile_payload = profile_to_dict(profile)
    goals = _goal_rows(profile)
    goal_snapshot = GoalSnapshot(
        goals_json=json.dumps(goals),
        goal_count=len(goals),
        total_funding_gap=sum(goal.get("fundingGap", 0) for goal in goals),
        highest_priority_goal=goals[0]["name"] if goals else "",
        created_at=now_iso(),
    )
    behavior = _behavior_payload(profile)
    behavioral_snapshot = BehavioralSnapshot(
        snapshot_json=json.dumps(behavior),
        savings_rate=behavior["savingsRate"],
        emi_burden=behavior["emiBurden"],
        risk_taking_score=behavior["riskTakingScore"],
        consistency_score=behavior["consistencyScore"],
        created_at=now_iso(),
    )
    db.add(goal_snapshot)
    db.add(behavioral_snapshot)
    db.flush()
    event = FinancialMemoryEvent(
        event_type=source,
        category="profile",
        title="Financial profile saved",
        summary=f"Saved profile with {len(goals)} goal(s), savings rate {behavior['savingsRate']}%, and net worth Rs {net_worth(profile):,.0f}.",
        entity_type="profile",
        entity_id="latest",
        severity="info",
        payload_json=json.dumps(profile_payload),
        created_at=now_iso(),
    )
    db.add(event)
    db.commit()
    return {"goals": _goal_snapshot_payload(goal_snapshot), "behavior": _behavior_snapshot_payload(behavioral_snapshot), "event": _event_payload(event)}


def snapshot_portfolio(db: Session, optimization: dict, source: str = "portfolio_optimization") -> dict:
    summary = optimization.get("summary", {})
    row = PortfolioSnapshot(
        source=source,
        snapshot_json=json.dumps(optimization),
        total_value=summary.get("totalPortfolioValue", 0),
        allocation_drift=summary.get("allocationDrift", 0),
        concentration_score=summary.get("concentrationScore", 0),
        risk_exposure=summary.get("riskExposure", ""),
        created_at=now_iso(),
    )
    db.add(row)
    db.flush()
    db.add(
        FinancialMemoryEvent(
            event_type=source,
            category="portfolio",
            title="Portfolio optimization saved",
            summary=f"Portfolio health {summary.get('portfolioHealth', 0)}%, drift {summary.get('allocationDrift', 0)}%, risk exposure {summary.get('riskExposure', 'unknown')}.",
            entity_type="portfolio",
            entity_id=str(row.id),
            severity="medium" if summary.get("allocationDrift", 0) >= 20 else "info",
            payload_json=json.dumps({"summary": summary}),
            created_at=now_iso(),
        )
    )
    db.commit()
    return _portfolio_snapshot_payload(row)


def version_recommendations(db: Session, recommendations: list[dict], reason: str = "research refresh") -> list[dict]:
    enriched = []
    for recommendation in recommendations:
        key = recommendation_key(recommendation)
        latest = _latest_version(db, key)
        changed_fields = _changed_fields(json.loads(latest.recommendation_json) if latest else {}, recommendation)
        should_create = latest is None or bool(changed_fields)
        if should_create:
            version_number = (latest.version_number + 1) if latest else 1
            change_reason = _change_reason(latest, recommendation, changed_fields, reason)
            state = _recommendation_state(recommendation)
            row = RecommendationVersion(
                recommendation_key=key,
                instrument_name=recommendation.get("instrumentName", ""),
                asset_type=recommendation.get("assetType", ""),
                version_number=version_number,
                recommendation_json=json.dumps(recommendation),
                change_reason=change_reason,
                changed_fields_json=json.dumps(changed_fields),
                market_regime=recommendation.get("marketRegime", ""),
                conviction_score=recommendation.get("convictionScore", 0),
                confidence_score=recommendation.get("confidenceScore", 0),
                risk_level=recommendation.get("riskLevel", ""),
                state=state,
                created_at=now_iso(),
            )
            db.add(row)
            db.flush()
            db.add(
                FinancialMemoryEvent(
                    event_type="recommendation_versioned",
                    category="recommendation",
                    title=f"Recommendation updated: {recommendation.get('instrumentName', 'Investment idea')}",
                    summary=change_reason,
                    entity_type="recommendation",
                    entity_id=key,
                    severity="medium" if version_number > 1 else "info",
                    payload_json=json.dumps({"changedFields": changed_fields, "version": version_number}),
                    created_at=row.created_at,
                )
            )
            current_version = row
        else:
            current_version = latest
        recommendation["recommendationKey"] = key
        recommendation["versionNumber"] = current_version.version_number
        recommendation["lastUpdated"] = current_version.created_at
        recommendation["whyChanged"] = current_version.change_reason if should_create else "No material change since the last recommendation version."
        recommendation["changedFields"] = _loads(current_version.changed_fields_json)
        recommendation["recommendationState"] = current_version.state
        enriched.append(recommendation)
    db.commit()
    return enriched


def recommendation_history(db: Session, limit: int = 80) -> list[dict]:
    rows = db.query(RecommendationVersion).order_by(RecommendationVersion.id.desc()).limit(limit).all()
    return [_version_payload(row) for row in rows]


def recommendation_versions(db: Session, recommendation_key_value: str | None = None) -> list[dict]:
    query = db.query(RecommendationVersion)
    if recommendation_key_value:
        query = query.filter(RecommendationVersion.recommendation_key == recommendation_key_value)
    rows = query.order_by(RecommendationVersion.recommendation_key, RecommendationVersion.version_number).all()
    return [_version_payload(row) for row in rows]


def record_user_action(db: Session, action: dict, user_id: int | None = None) -> dict:
    key = action.get("recommendationKey") or action.get("entityId") or ""
    name = action.get("instrumentName") or action.get("entityName") or ""
    action_type = action.get("actionType", "viewed")
    row = UserActionEvent(
        user_id=user_id,
        action_type=action_type,
        entity_type=action.get("entityType", "recommendation"),
        entity_id=key,
        entity_name=name,
        payload_json=json.dumps(action),
        created_at=now_iso(),
    )
    db.add(row)
    outcome = None
    if key:
        outcome = db.query(RecommendationOutcome).filter(RecommendationOutcome.recommendation_key == key).first()
        if not outcome:
            outcome = RecommendationOutcome(
                recommendation_key=key,
                instrument_name=name,
                status="open",
                action_count=0,
                updated_at=now_iso(),
            )
            db.add(outcome)
        outcome.action_count = (outcome.action_count or 0) + 1
        outcome.last_action = action_type
        outcome.status = _status_from_action(action_type, outcome.status or "open")
        outcome.notes = _outcome_note(action_type)
        outcome.updated_at = now_iso()
    db.add(
        FinancialMemoryEvent(
            event_type="user_action",
            category="behavior",
            title=f"User action: {action_type.replace('_', ' ')}",
            summary=f"{name or action.get('entityType', 'Item')} was marked as {action_type.replace('_', ' ')}.",
            entity_type=action.get("entityType", "recommendation"),
            entity_id=key,
            severity="info",
            payload_json=json.dumps(action),
            created_at=now_iso(),
        )
    )
    db.commit()
    db.refresh(row)
    return {"action": _action_payload(row), "outcome": _outcome_payload(outcome) if outcome else None}


def timeline(db: Session, limit: int = 80) -> dict:
    events = db.query(FinancialMemoryEvent).order_by(FinancialMemoryEvent.id.desc()).limit(limit).all()
    actions = db.query(UserActionEvent).order_by(UserActionEvent.id.desc()).limit(20).all()
    logs = db.query(RecommendationReassessmentLog).order_by(RecommendationReassessmentLog.id.desc()).limit(20).all()
    return {
        "events": [_event_payload(row) for row in events],
        "userActions": [_action_payload(row) for row in actions],
        "reassessmentLogs": [_reassessment_payload(row) for row in logs],
        "summary": adaptive_summary(db),
    }


def adaptive_summary(db: Session) -> dict:
    rec_versions = db.query(RecommendationVersion).count()
    actions = db.query(UserActionEvent).count()
    alerts = db.query(DriftAlert).filter(DriftAlert.status == "open").count()
    latest_event = db.query(FinancialMemoryEvent).order_by(FinancialMemoryEvent.id.desc()).first()
    latest_reassessment = db.query(RecommendationReassessmentLog).order_by(RecommendationReassessmentLog.id.desc()).first()
    ignored_crypto = (
        db.query(UserActionEvent)
        .filter(UserActionEvent.action_type.in_(["rejected", "ignored", "dismissed"]))
        .filter(UserActionEvent.entity_name.ilike("%bitcoin%") | UserActionEvent.entity_name.ilike("%ethereum%") | UserActionEvent.entity_name.ilike("%crypto%"))
        .count()
    )
    return {
        "memoryEventCount": db.query(FinancialMemoryEvent).count(),
        "recommendationVersionCount": rec_versions,
        "userActionCount": actions,
        "openDriftAlertCount": alerts,
        "latestEvent": _event_payload(latest_event) if latest_event else None,
        "latestReassessment": _reassessment_payload(latest_reassessment) if latest_reassessment else None,
        "learningNotes": _learning_notes(ignored_crypto, actions),
    }


def portfolio_drift(db: Session, profile: OnboardingProfile | None = None) -> dict:
    optimization = optimize_portfolio(db, profile, persist=False) if profile else latest_optimization(db)
    if not optimization and profile:
        optimization = optimize_portfolio(db, profile, persist=False)
    if not optimization:
        return {"alerts": [], "summary": {"status": "empty", "message": "Portfolio optimization has not run yet."}}
    summary = optimization["summary"]
    alerts: list[dict] = []
    for bucket in optimization.get("bucketAllocations", []):
        gap = bucket.get("gapPercentage", 0)
        if gap >= 10:
            alerts.append(_drift_dict("portfolio", "medium", f"Underweight {bucket['bucketName']}", f"{bucket['bucketName']} is {gap} percentage points below target.", "gap", f"{bucket.get('currentPercentage', 0)}%", f"{bucket.get('targetPercentage', 0)}%", "Route fresh monthly money here before adding to overweight buckets.", bucket))
        elif gap <= -10:
            alerts.append(_drift_dict("portfolio", "high", f"Overweight {bucket['bucketName']}", f"{bucket['bucketName']} is {abs(gap)} percentage points above target.", "gap", f"{bucket.get('currentPercentage', 0)}%", f"{bucket.get('targetPercentage', 0)}%", "Pause new allocation here and use fresh money for underweight buckets.", bucket))
    if summary.get("allocationDrift", 0) >= 25:
        alerts.append(_drift_dict("portfolio", "high", "Portfolio drift is high", f"Current allocation differs from target by about {summary['allocationDrift']} percentage points.", "allocationDrift", str(summary["allocationDrift"]), "<20", summary.get("topRebalancingAction", "Review bucket gaps."), summary))
    if summary.get("concentrationScore", 100) < 50:
        alerts.append(_drift_dict("portfolio", "high", "Concentration risk increased", f"Concentration score is {summary['concentrationScore']}%.", "concentration", str(summary["concentrationScore"]), ">70", "Avoid adding to already overweight buckets.", summary))
    _save_drift_alerts(db, alerts)
    return {"alerts": alerts, "summary": summary, "bucketAllocations": optimization.get("bucketAllocations", [])}


def goal_drift(db: Session, profile: OnboardingProfile) -> dict:
    goals = _goal_rows(profile)
    previous = db.query(GoalSnapshot).order_by(GoalSnapshot.id.desc()).offset(1).first()
    previous_goals = {goal.get("name"): goal for goal in _loads(previous.goals_json) if goal.get("name")} if previous else {}
    surplus = computed_monthly_surplus(profile)
    alerts = []
    for goal in goals:
        required = goal["fundingGap"] / max(goal["monthsLeft"], 1)
        if goal["monthsLeft"] <= 12 and goal["fundingGap"] > 0:
            alerts.append(_drift_dict("goal", "high" if required > surplus * 0.7 else "medium", f"{goal['name']} deadline is approaching", f"{goal['name']} has {goal['monthsLeft']} months left and about Rs {goal['fundingGap']:,.0f} still unfunded.", "monthlyNeed", f"Rs {required:,.0f}", f"Surplus Rs {surplus:,.0f}", "Increase stable goal funding or adjust target/timeline.", goal))
        old = previous_goals.get(goal["name"])
        if old and (old.get("priority") != goal["priority"] or old.get("targetAmount") != goal["targetAmount"]):
            alerts.append(_drift_dict("goal", "medium", f"{goal['name']} changed", f"Priority or target amount changed since the last saved goal snapshot.", "goalChange", f"P{old.get('priority')} / Rs {old.get('targetAmount', 0):,.0f}", f"P{goal['priority']} / Rs {goal['targetAmount']:,.0f}", "Reassess recommendations tied to this goal.", {"old": old, "new": goal}))
    _save_drift_alerts(db, alerts)
    return {"alerts": alerts, "goals": goals, "summary": {"goalCount": len(goals), "totalFundingGap": sum(goal["fundingGap"] for goal in goals)}}


def behavioral_drift(db: Session, profile: OnboardingProfile) -> dict:
    behavior = _behavior_payload(profile)
    previous = db.query(BehavioralSnapshot).order_by(BehavioralSnapshot.id.desc()).offset(1).first()
    alerts = []
    if behavior["savingsRate"] < 20:
        alerts.append(_drift_dict("behavior", "high", "Savings rate is below plan", f"Savings rate is {behavior['savingsRate']}%.", "savingsRate", f"{behavior['savingsRate']}%", "20%+", "Reduce discretionary spending before increasing tactical exposure.", behavior))
    if behavior["emiBurden"] > 35:
        alerts.append(_drift_dict("behavior", "high", "EMI burden is high", f"EMIs are about {behavior['emiBurden']}% of monthly income.", "emiBurden", f"{behavior['emiBurden']}%", "<35%", "Avoid new EMI goals until debt load improves.", behavior))
    if behavior["riskTakingScore"] >= 70:
        alerts.append(_drift_dict("behavior", "medium", "Risk-taking behavior needs guardrails", "Behavior answers suggest higher risk-taking or panic-sell risk.", "riskTaking", str(behavior["riskTakingScore"]), "<70", "Keep crypto and tactical buckets capped.", behavior))
    if previous and behavior["savingsRate"] < previous.savings_rate - 8:
        alerts.append(_drift_dict("behavior", "medium", "Savings rate fell", f"Savings rate fell from {previous.savings_rate}% to {behavior['savingsRate']}%.", "savingsRateChange", f"{behavior['savingsRate']}%", f"{previous.savings_rate}%", "Review expenses and scheduled investments.", behavior))
    _save_drift_alerts(db, alerts)
    return {"alerts": alerts, "behavior": behavior, "summary": {"savingsRate": behavior["savingsRate"], "emiBurden": behavior["emiBurden"], "consistencyScore": behavior["consistencyScore"]}}


def drift_alerts(db: Session) -> list[dict]:
    rows = db.query(DriftAlert).order_by(DriftAlert.id.desc()).limit(80).all()
    return [_drift_payload(row) for row in rows]


def reassess_recommendations(db: Session, profile: OnboardingProfile | None, trigger: str = "manual review") -> dict:
    from app.agents.explainability_agent import persist_recommendation_explainability
    from app.agents.recommendation_action_agent import generate_advanced_recommendations

    result = generate_advanced_recommendations(profile, db)
    result["recommendations"] = version_recommendations(db, result["recommendations"], reason=trigger)
    portfolio = portfolio_drift(db, profile) if profile else portfolio_drift(db)
    logs = []
    for rec in result["recommendations"]:
        previous_state = "active"
        new_state = rec.get("recommendationState", _recommendation_state(rec))
        if rec.get("validationScore", 100) < 30 or rec.get("confidenceScore", 100) < 55:
            new_state = "watchlist"
            rec["recommendationState"] = "watchlist"
        persist_recommendation_explainability(db, rec)
        summary = _reassessment_summary(rec, portfolio.get("alerts", []))
        row = RecommendationReassessmentLog(
            recommendation_key=rec.get("recommendationKey", recommendation_key(rec)),
            instrument_name=rec.get("instrumentName", ""),
            trigger=trigger,
            previous_state=previous_state,
            new_state=new_state,
            summary=summary,
            payload_json=json.dumps({"confidence": rec.get("confidenceScore"), "conviction": rec.get("convictionScore"), "portfolioAlerts": portfolio.get("alerts", [])[:3]}),
            created_at=now_iso(),
        )
        db.add(row)
        logs.append(row)
    db.add(
        FinancialMemoryEvent(
            event_type="recommendations_reassessed",
            category="recommendation",
            title="Recommendations reassessed",
            summary=f"Reassessed {len(result['recommendations'])} recommendation(s) using current profile, market regime, drift, and validation context.",
            entity_type="recommendation_batch",
            entity_id=now_iso(),
            severity="medium" if portfolio.get("alerts") else "info",
            payload_json=json.dumps({"trigger": trigger, "portfolioAlertCount": len(portfolio.get("alerts", []))}),
            created_at=now_iso(),
        )
    )
    db.commit()
    return {
        "status": "reassessed",
        "recommendations": result["recommendations"],
        "logs": [_reassessment_payload(row) for row in logs],
        "portfolioDrift": portfolio,
        "summary": adaptive_summary(db),
    }


def memory_context(db: Session) -> dict:
    return {
        "summary": adaptive_summary(db),
        "portfolioDrift": portfolio_drift(db),
        "driftAlerts": drift_alerts(db)[:10],
        "recommendationHistory": recommendation_history(db, limit=20),
        "recentActions": [_action_payload(row) for row in db.query(UserActionEvent).order_by(UserActionEvent.id.desc()).limit(20).all()],
    }


def _latest_version(db: Session, key: str) -> RecommendationVersion | None:
    return db.query(RecommendationVersion).filter(RecommendationVersion.recommendation_key == key).order_by(RecommendationVersion.version_number.desc()).first()


def _changed_fields(previous: dict, current: dict) -> list[dict]:
    if not previous:
        return []
    checks = [
        ("suggestedAllocationPercentage", "allocation"),
        ("suggestedMonthlyAmount", "monthly amount"),
        ("confidenceScore", "confidence"),
        ("convictionScore", "conviction"),
        ("riskLevel", "risk level"),
        ("marketRegime", "market regime"),
        ("recommendationType", "recommendation type"),
        ("portfolioBucket", "portfolio bucket"),
        ("action", "action"),
    ]
    changed = []
    for key, label in checks:
        old = previous.get(key)
        new = current.get(key)
        if old != new:
            changed.append({"field": key, "label": label, "previous": old, "current": new})
    return changed


def _change_reason(latest: RecommendationVersion | None, recommendation: dict, changed_fields: list[dict], reason: str) -> str:
    if not latest:
        return f"Initial version created from {reason}."
    highlights = []
    for field in changed_fields[:3]:
        highlights.append(f"{field['label']} changed from {field['previous']} to {field['current']}")
    return f"{'; '.join(highlights)} because of {reason}."


def _recommendation_state(recommendation: dict) -> str:
    action = str(recommendation.get("action", "")).lower()
    if "avoid" in action:
        return "archived"
    if "watch" in action or recommendation.get("validationScore", 100) < 30:
        return "watchlist"
    return "active"


def _status_from_action(action_type: str, current: str) -> str:
    if action_type in {"accepted", "completed"}:
        return "accepted"
    if action_type in {"rejected", "dismissed"}:
        return "rejected"
    if action_type in {"added_to_watchlist", "watchlist"}:
        return "watchlist"
    if action_type in {"marked_reviewed", "reviewed"}:
        return "reviewed"
    return current


def _outcome_note(action_type: str) -> str:
    if action_type in {"rejected", "ignored", "dismissed"}:
        return "Future recommendations should reduce similar ideas unless stronger evidence appears."
    if action_type in {"accepted", "completed"}:
        return "Future recommendations can account for this as user preference evidence."
    if action_type in {"added_to_watchlist", "watchlist"}:
        return "Keep tracking this idea, but do not treat it as accepted."
    return "Action recorded for personalization."


def _goal_rows(profile: OnboardingProfile) -> list[dict]:
    rows = []
    for goal in sorted(profile.goals, key=lambda item: item.priority):
        name = goal.customName if goal.type == "Other" and goal.customName else goal.type
        target = calculated_goal_target(goal)
        current = goal.currentAmount
        rows.append(
            {
                "name": name or "Goal",
                "type": goal.type,
                "priority": goal.priority,
                "targetAmount": target,
                "currentAmount": current,
                "fundingGap": max(target - current, 0),
                "targetDate": goal.targetDate,
                "monthsLeft": months_until(goal.targetDate, 60),
                "paymentStyle": goal.paymentStyle,
            }
        )
    return rows


def _behavior_payload(profile: OnboardingProfile) -> dict:
    income = max(monthly_income(profile), 1)
    emi_total = total_emi_payments(profile)
    surplus = computed_monthly_surplus(profile)
    savings_rate = round(surplus / income * 100)
    emi_burden = round(emi_total / income * 100)
    risk_text = " ".join([profile.riskReaction, profile.panicSellRisk, profile.opportunityPreference, profile.shortTermVolatilityComfort]).lower()
    risk_taking = 45
    if "sell" in risk_text or "panic" in risk_text:
        risk_taking += 20
    if "frequent" in risk_text or "high" in risk_text:
        risk_taking += 18
    if "calm" in risk_text or "stable" in risk_text:
        risk_taking -= 12
    consistency = 70
    if profile.investsMonthly.lower() in {"rarely", "no", "never"}:
        consistency -= 30
    if profile.tracksExpenses.lower() in {"rarely", "no", "never"}:
        consistency -= 20
    if profile.spendingDiscipline.lower() in {"low", "rarely"}:
        consistency -= 15
    return {
        "savingsRate": max(0, min(100, savings_rate)),
        "emiBurden": max(0, emi_burden),
        "riskTakingScore": max(0, min(100, risk_taking)),
        "consistencyScore": max(0, min(100, consistency)),
        "spendingDiscipline": profile.spendingDiscipline,
        "tracksExpenses": profile.tracksExpenses,
        "investsMonthly": profile.investsMonthly,
        "panicSellRisk": profile.panicSellRisk,
        "investingBlocker": profile.investingBlocker,
    }


def _save_drift_alerts(db: Session, alerts: list[dict]) -> None:
    for alert in alerts:
        existing = (
            db.query(DriftAlert)
            .filter(DriftAlert.drift_type == alert["driftType"])
            .filter(DriftAlert.title == alert["title"])
            .filter(DriftAlert.status == "open")
            .first()
        )
        if existing:
            existing.summary = alert["summary"]
            existing.current_value = str(alert.get("currentValue", ""))
            existing.target_value = str(alert.get("targetValue", ""))
            existing.payload_json = json.dumps(alert.get("payload", {}))
            existing.created_at = alert["createdAt"]
            continue
        db.add(
            DriftAlert(
                drift_type=alert["driftType"],
                severity=alert["severity"],
                title=alert["title"],
                summary=alert["summary"],
                metric_name=alert.get("metricName", ""),
                current_value=str(alert.get("currentValue", "")),
                target_value=str(alert.get("targetValue", "")),
                recommendation=alert.get("recommendation", ""),
                payload_json=json.dumps(alert.get("payload", {})),
                created_at=alert["createdAt"],
            )
        )
    if alerts:
        db.commit()


def _drift_dict(drift_type: str, severity: str, title: str, summary: str, metric_name: str, current: str, target: str, recommendation: str, payload: dict) -> dict:
    return {
        "driftType": drift_type,
        "severity": severity,
        "title": title,
        "summary": summary,
        "metricName": metric_name,
        "currentValue": current,
        "targetValue": target,
        "recommendation": recommendation,
        "payload": payload,
        "status": "open",
        "createdAt": now_iso(),
    }


def _reassessment_summary(rec: dict, portfolio_alerts: list[dict]) -> str:
    if rec.get("validationScore", 100) < 30:
        return "Historical validation is weak, so this idea should be reviewed or kept as Watchlist."
    if rec.get("confidenceScore", 100) < 55:
        return "Evidence confidence weakened; allocation should be reduced until support improves."
    if portfolio_alerts and rec.get("portfolioBucketKey") in {alert.get("payload", {}).get("bucketKey") for alert in portfolio_alerts}:
        return "Portfolio drift affects this recommendation's bucket, so sizing should be reviewed."
    return "Recommendation remains usable, subject to source verification and risk caps."


def _learning_notes(ignored_crypto: int, actions: int) -> list[str]:
    notes = []
    if ignored_crypto >= 2:
        notes.append("Crypto ideas have been repeatedly ignored or rejected; future crypto frequency should be reduced unless the user asks for it.")
    if actions == 0:
        notes.append("No user action history yet; personalization is based mostly on profile and portfolio state.")
    else:
        notes.append("User action history is now part of recommendation personalization.")
    notes.append("Unsafe behavior is never amplified; high-risk buckets remain capped by suitability and goals.")
    return notes


def _loads(value: str | None) -> Any:
    try:
        return json.loads(value or "[]")
    except json.JSONDecodeError:
        return []


def _event_payload(row: FinancialMemoryEvent | None) -> dict:
    if not row:
        return {}
    return {
        "id": row.id,
        "eventType": row.event_type,
        "category": row.category,
        "title": row.title,
        "summary": row.summary,
        "entityType": row.entity_type,
        "entityId": row.entity_id,
        "severity": row.severity,
        "payload": _loads(row.payload_json),
        "createdAt": row.created_at,
    }


def _version_payload(row: RecommendationVersion) -> dict:
    return {
        "id": row.id,
        "recommendationKey": row.recommendation_key,
        "instrumentName": row.instrument_name,
        "assetType": row.asset_type,
        "versionNumber": row.version_number,
        "changeReason": row.change_reason,
        "changedFields": _loads(row.changed_fields_json),
        "marketRegime": row.market_regime,
        "convictionScore": row.conviction_score,
        "confidenceScore": row.confidence_score,
        "riskLevel": row.risk_level,
        "state": row.state,
        "recommendation": _loads(row.recommendation_json),
        "createdAt": row.created_at,
    }


def _portfolio_snapshot_payload(row: PortfolioSnapshot) -> dict:
    return {
        "id": row.id,
        "source": row.source,
        "snapshot": _loads(row.snapshot_json),
        "totalValue": row.total_value,
        "allocationDrift": row.allocation_drift,
        "concentrationScore": row.concentration_score,
        "riskExposure": row.risk_exposure,
        "createdAt": row.created_at,
    }


def _goal_snapshot_payload(row: GoalSnapshot) -> dict:
    return {
        "id": row.id,
        "goals": _loads(row.goals_json),
        "goalCount": row.goal_count,
        "totalFundingGap": row.total_funding_gap,
        "highestPriorityGoal": row.highest_priority_goal,
        "createdAt": row.created_at,
    }


def _behavior_snapshot_payload(row: BehavioralSnapshot) -> dict:
    return {
        "id": row.id,
        "snapshot": _loads(row.snapshot_json),
        "savingsRate": row.savings_rate,
        "emiBurden": row.emi_burden,
        "riskTakingScore": row.risk_taking_score,
        "consistencyScore": row.consistency_score,
        "createdAt": row.created_at,
    }


def _action_payload(row: UserActionEvent) -> dict:
    return {
        "id": row.id,
        "actionType": row.action_type,
        "entityType": row.entity_type,
        "entityId": row.entity_id,
        "entityName": row.entity_name,
        "payload": _loads(row.payload_json),
        "createdAt": row.created_at,
    }


def _outcome_payload(row: RecommendationOutcome | None) -> dict:
    if not row:
        return {}
    return {
        "id": row.id,
        "recommendationKey": row.recommendation_key,
        "instrumentName": row.instrument_name,
        "status": row.status,
        "actionCount": row.action_count,
        "lastAction": row.last_action,
        "notes": row.notes,
        "updatedAt": row.updated_at,
    }


def _reassessment_payload(row: RecommendationReassessmentLog | None) -> dict:
    if not row:
        return {}
    return {
        "id": row.id,
        "recommendationKey": row.recommendation_key,
        "instrumentName": row.instrument_name,
        "trigger": row.trigger,
        "previousState": row.previous_state,
        "newState": row.new_state,
        "summary": row.summary,
        "payload": _loads(row.payload_json),
        "createdAt": row.created_at,
    }


def _drift_payload(row: DriftAlert) -> dict:
    return {
        "id": row.id,
        "driftType": row.drift_type,
        "severity": row.severity,
        "title": row.title,
        "summary": row.summary,
        "metricName": row.metric_name,
        "currentValue": row.current_value,
        "targetValue": row.target_value,
        "recommendation": row.recommendation,
        "payload": _loads(row.payload_json),
        "status": row.status,
        "createdAt": row.created_at,
    }
