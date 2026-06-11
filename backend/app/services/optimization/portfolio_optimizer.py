from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.portfolio_bucket_allocation import PortfolioBucketAllocation
from app.models.portfolio_optimization_run import PortfolioOptimizationRun
from app.models.portfolio_rebalancing_suggestion import PortfolioRebalancingSuggestion
from app.models.portfolio_risk_metric import PortfolioRiskMetric
from app.models.portfolio_target_allocation import PortfolioTargetAllocation
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import net_worth, now_iso, profile_to_dict
from app.services.market.signal_intelligence_service import latest_market_regime
from app.services.optimization.allocation_optimizer import bucket_allocations, current_bucket_values, target_bucket_percentages, target_rows
from app.services.optimization.correlation_service import overlap_warnings, save_correlation_cache
from app.services.optimization.diversification_service import allocation_drift, concentration_score, diversification_score
from app.services.optimization.goal_based_allocation_service import goal_allocation_profile
from app.services.optimization.risk_model_service import allocation_constraints, risk_profile
from app.services.optimization.volatility_budgeting_service import portfolio_volatility_score, volatility_budget_notes
from app.services.recommendations.suitability_scoring_service import build_profile_context


def optimize_portfolio(db: Session, profile: OnboardingProfile, persist: bool = True) -> dict:
    context = build_profile_context(profile)
    regime = latest_market_regime(db)
    constraints = allocation_constraints(context, regime)
    goals = goal_allocation_profile(profile)
    targets = target_bucket_percentages(context, goals, constraints, regime)
    buckets = bucket_allocations(profile, context, goals["goals"], targets)
    current_values = current_bucket_values(profile, context)
    worth = max(net_worth(profile), 1)
    current_pct = {key: round(value / worth * 100) for key, value in current_values.items()}
    div_score = diversification_score(targets, current_values)
    conc_score = concentration_score(current_pct, targets)
    vol_score = portfolio_volatility_score(targets)
    drift = allocation_drift(current_pct, targets)
    goal_score = _goal_alignment_score(goals, context, buckets)
    risk_metrics = _risk_metrics(targets, current_pct, constraints, div_score, conc_score, vol_score, goal_score, drift)
    suggestions = _rebalancing_suggestions(buckets, constraints, context, targets, current_pct)
    target_allocations = target_rows(targets)
    result = {
        "summary": {
            "portfolioHealth": round((div_score + conc_score + goal_score + max(0, 100 - drift)) / 4),
            "marketRegime": regime.get("regimeName", regime.get("regime", "balanced")),
            "riskProfile": risk_profile(context),
            "totalPortfolioValue": worth,
            "monthlySurplus": context.surplus,
            "diversificationScore": div_score,
            "concentrationScore": conc_score,
            "volatilityScore": vol_score,
            "goalAlignmentScore": goal_score,
            "allocationDrift": drift,
            "tacticalAllocationCap": constraints["tacticalAllocationCap"],
            "cryptoAllocationCap": constraints["cryptoAllocationCap"],
            "topRebalancingAction": suggestions[0]["title"] if suggestions else "Your investments are close enough to the suggested mix for now.",
            "riskExposure": _risk_exposure(vol_score, conc_score),
        },
        "currentAllocation": [{"bucketKey": key, "bucketName": _name_for_bucket(key, buckets), "percentage": current_pct.get(key, 0), "value": current_values.get(key, 0)} for key in targets],
        "targetAllocation": target_allocations,
        "bucketAllocations": buckets,
        "riskMetrics": risk_metrics,
        "rebalancingSuggestions": suggestions,
        "monthlyDeploymentPlan": _monthly_plan(buckets),
        "riskWarnings": _risk_warnings(context, targets, current_pct, constraints, vol_score),
        "regimeAdjustments": _regime_adjustments(regime, targets),
        "optimizationNotes": volatility_budget_notes(targets, constraints["maxVolatilityScore"]),
        "retrievedAt": now_iso(),
    }
    if persist:
        result["runId"] = _persist(db, profile, result, regime, constraints)
    return result


def latest_optimization(db: Session) -> dict | None:
    run = db.query(PortfolioOptimizationRun).order_by(PortfolioOptimizationRun.id.desc()).first()
    if not run:
        return None
    buckets = db.query(PortfolioBucketAllocation).filter(PortfolioBucketAllocation.run_id == run.id).all()
    targets = db.query(PortfolioTargetAllocation).filter(PortfolioTargetAllocation.run_id == run.id).all()
    metrics = db.query(PortfolioRiskMetric).filter(PortfolioRiskMetric.run_id == run.id).all()
    suggestions = db.query(PortfolioRebalancingSuggestion).filter(PortfolioRebalancingSuggestion.run_id == run.id).order_by(PortfolioRebalancingSuggestion.priority).all()
    return {
        "runId": run.id,
        "summary": {
            "portfolioHealth": round((run.diversification_score + run.concentration_score + run.goal_alignment_score + max(0, 100 - run.allocation_drift_score)) / 4),
            "marketRegime": run.market_regime,
            "riskProfile": run.risk_profile,
            "totalPortfolioValue": run.total_portfolio_value,
            "monthlySurplus": run.monthly_surplus,
            "diversificationScore": run.diversification_score,
            "concentrationScore": run.concentration_score,
            "volatilityScore": run.volatility_score,
            "goalAlignmentScore": run.goal_alignment_score,
            "allocationDrift": run.allocation_drift_score,
            "tacticalAllocationCap": run.tactical_allocation_cap,
            "cryptoAllocationCap": run.crypto_allocation_cap,
            "topRebalancingAction": suggestions[0].title if suggestions else "Your investments are close enough to the suggested mix for now.",
            "riskExposure": _risk_exposure(run.volatility_score, run.concentration_score),
        },
        "currentAllocation": [
            {"bucketKey": row.bucket_key, "bucketName": row.bucket_name, "percentage": row.current_percentage, "value": row.current_value}
            for row in buckets
        ],
        "targetAllocation": [_target_payload(row) for row in targets],
        "bucketAllocations": [_bucket_payload(row) for row in buckets],
        "riskMetrics": [_metric_payload(row) for row in metrics],
        "rebalancingSuggestions": [_suggestion_payload(row) for row in suggestions],
        "monthlyDeploymentPlan": [_bucket_payload(row) for row in buckets if row.monthly_contribution > 0],
        "riskWarnings": [row.explanation for row in metrics if row.severity in {"high", "medium"}],
        "regimeAdjustments": [],
        "optimizationNotes": [run.summary],
        "retrievedAt": run.retrieved_at,
    }


def _persist(db: Session, profile: OnboardingProfile, result: dict, regime: dict, constraints: dict) -> int:
    summary = result["summary"]
    run = PortfolioOptimizationRun(
        profile_snapshot_json=json.dumps(profile_to_dict(profile)),
        market_regime=summary["marketRegime"],
        risk_profile=summary["riskProfile"],
        total_portfolio_value=summary["totalPortfolioValue"],
        monthly_surplus=summary["monthlySurplus"],
        diversification_score=summary["diversificationScore"],
        concentration_score=summary["concentrationScore"],
        volatility_score=summary["volatilityScore"],
        goal_alignment_score=summary["goalAlignmentScore"],
        allocation_drift_score=summary["allocationDrift"],
        tactical_allocation_cap=constraints["tacticalAllocationCap"],
        crypto_allocation_cap=constraints["cryptoAllocationCap"],
        summary="; ".join(result["optimizationNotes"][:3]),
        retrieved_at=result["retrievedAt"],
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    save_correlation_cache(db, [row["bucketKey"] for row in result["targetAllocation"]])
    for row in result["targetAllocation"]:
        db.add(PortfolioTargetAllocation(run_id=run.id, bucket_key=row["bucketKey"], bucket_name=row["bucketName"], target_percentage=row["targetPercentage"], min_percentage=row["minPercentage"], max_percentage=row["maxPercentage"], expected_return=row["expectedReturn"], volatility=row["volatility"], risk_level=row["riskLevel"], rationale=row["rationale"]))
    for row in result["bucketAllocations"]:
        db.add(PortfolioBucketAllocation(run_id=run.id, bucket_key=row["bucketKey"], bucket_name=row["bucketName"], current_value=row["currentValue"], current_percentage=row["currentPercentage"], target_value=row["targetValue"], target_percentage=row["targetPercentage"], gap_value=row["gapValue"], gap_percentage=row["gapPercentage"], monthly_contribution=row["monthlyContribution"], risk_level=row["riskLevel"], linked_goals_json=json.dumps(row["linkedGoals"])))
    for row in result["riskMetrics"]:
        db.add(PortfolioRiskMetric(run_id=run.id, metric_name=row["metricName"], score=row["score"], severity=row["severity"], explanation=row["explanation"], recommendation=row["recommendation"]))
    for row in result["rebalancingSuggestions"]:
        db.add(PortfolioRebalancingSuggestion(run_id=run.id, priority=row["priority"], action=row["action"], bucket_key=row["bucketKey"], title=row["title"], explanation=row["explanation"], monthly_amount=row["monthlyAmount"], drift_percentage=row["driftPercentage"], risk_impact=row["riskImpact"], trigger=row["trigger"]))
    db.commit()
    return run.id


def _risk_metrics(targets: dict[str, int], current_pct: dict[str, int], constraints: dict, div_score: int, conc_score: int, vol_score: int, goal_score: int, drift: int) -> list[dict]:
    return [
        {"metricName": "How well your money is spread out", "score": div_score, "severity": _severity(div_score), "explanation": "Checks whether your money is spread across different areas.", "recommendation": "Add new money to areas that need more before adding to areas that already have enough."},
        {"metricName": "Dependence on a few investments", "score": conc_score, "severity": _severity(conc_score), "explanation": "Checks whether too much money depends on one area.", "recommendation": "Keep single shares, short-term ideas, and digital assets within their suggested limits."},
        {"metricName": "How much prices may move", "score": max(0, 100 - vol_score), "severity": "high" if vol_score > constraints["maxVolatilityScore"] else "medium" if vol_score > constraints["maxVolatilityScore"] - 10 else "low", "explanation": f"Your estimated ups-and-downs score is {vol_score}.", "recommendation": "Invest gradually and add steadier areas if your plan may move more than you are comfortable with."},
        {"metricName": "How well your investments match your goals", "score": goal_score, "severity": _severity(goal_score), "explanation": "Checks whether important and near-term goals have safer funding paths.", "recommendation": "Fund emergency savings and essential goals before short-term ideas or digital assets."},
        {"metricName": "Difference from your suggested plan", "score": max(0, 100 - drift), "severity": "high" if drift > 35 else "medium" if drift > 18 else "low", "explanation": f"Your current mix differs from the suggested mix by about {drift} percentage points.", "recommendation": "Direct new monthly savings toward areas that need more first."},
    ]


def _rebalancing_suggestions(buckets: list[dict], constraints: dict, context, targets: dict, current_pct: dict[str, int]) -> list[dict]:
    suggestions = []
    for bucket in sorted(buckets, key=lambda row: row["gapPercentage"], reverse=True):
        if bucket["gapPercentage"] > 4:
            suggestions.append({"priority": len(suggestions) + 1, "action": "add", "bucketKey": bucket["bucketKey"], "title": f"Add to {bucket['bucketName']}", "explanation": f"This area is {bucket['gapPercentage']} percentage points below the suggested mix.", "monthlyAmount": bucket["monthlyContribution"], "driftPercentage": bucket["gapPercentage"], "riskImpact": "moves you closer to your plan", "trigger": "Use new monthly savings before selling existing investments."})
        elif bucket["gapPercentage"] < -7:
            suggestions.append({"priority": len(suggestions) + 1, "action": "trim", "bucketKey": bucket["bucketKey"], "title": f"Pause or reduce {bucket['BucketName'] if 'BucketName' in bucket else bucket['bucketName']}", "explanation": f"This area is {abs(bucket['gapPercentage'])} percentage points above the suggested mix.", "monthlyAmount": 0, "driftPercentage": bucket["gapPercentage"], "riskImpact": "reduces dependence on one area", "trigger": "Reduce only if taxes and access to your money are acceptable. Otherwise, direct new savings elsewhere."})
        if len(suggestions) >= 5:
            break
    if context.emergency_gap > 0:
        suggestions.insert(0, {"priority": 1, "action": "fund", "bucketKey": "emergency_reserve", "title": "Build emergency savings first", "explanation": f"Your emergency savings are short by about {context.emergency_gap}. Avoid adding digital assets or short-term ideas until this improves.", "monthlyAmount": min(context.emergency_gap, round(context.surplus * 0.6)), "driftPercentage": targets.get("emergency_reserve", 0) - current_pct.get("emergency_reserve", 0), "riskImpact": "reduces the chance of selling investments in an emergency", "trigger": "Continue until six months of expenses are covered."})
    for index, suggestion in enumerate(suggestions, start=1):
        suggestion["priority"] = index
    return suggestions


def _monthly_plan(buckets: list[dict]) -> list[dict]:
    return [bucket for bucket in buckets if bucket["monthlyContribution"] > 0]


def _goal_alignment_score(goal_profile: dict, context, buckets: list[dict]) -> int:
    score = 70
    if context.emergency_gap > 0:
        emergency = next((bucket for bucket in buckets if bucket["bucketKey"] == "emergency_reserve"), {})
        score += 12 if emergency.get("monthlyContribution", 0) > 0 else -18
    if goal_profile["nearTermGoalCount"]:
        safer = sum(bucket["targetPercentage"] for bucket in buckets if bucket["bucketKey"] in {"emergency_reserve", "goal_specific_investments", "cash_buffer"})
        score += 10 if safer >= 40 else -12
    if goal_profile["aspirationalFundingGap"] and context.short_term_risk_ok:
        score += 5
    return max(5, min(95, score))


def _risk_warnings(context, targets: dict[str, int], current_pct: dict[str, int], constraints: dict, vol_score: int) -> list[str]:
    warnings = []
    if context.emergency_gap > 0:
        warnings.append("Your emergency savings are below the suggested level, so higher-risk investments are limited.")
    if current_pct.get("crypto_high_risk", 0) > constraints["cryptoAllocationCap"]:
        warnings.append("Your digital-asset holdings are above the suggested limit. Avoid adding more for now.")
    if targets.get("tactical_opportunities", 0) >= constraints["tacticalAllocationCap"]:
        warnings.append("Short-term ideas have reached their suggested limit. Replace weaker ideas instead of adding more.")
    if vol_score > constraints["maxVolatilityScore"]:
        warnings.append("Your investments may move more than your comfort level. Add steadier investments or invest gradually.")
    warnings.extend(overlap_warnings(targets))
    return warnings


def _regime_adjustments(regime: dict, targets: dict[str, int]) -> list[str]:
    name = (regime.get("regimeName") or regime.get("regime") or "balanced").lower()
    if name in {"risk-off", "bear market", "high volatility"}:
        return ["Reduced short-term ideas and digital assets.", "Raised the extra cash buffer and steadier investments.", "Prefer regular or gradual investing over one large amount."]
    if name in {"risk-on", "bull market", "liquidity-driven", "momentum-led"}:
        return ["Allowed a modest increase in long-term and short-term investments within limits.", "Keep your investment mix tied to your most important goals."]
    if name == "inflationary":
        return ["Raised steadier investments and money set aside for goals.", "Keep an eye on investments affected by interest rates and commodity prices."]
    return ["Kept the suggested mix balanced because market conditions are still mixed."]


def _risk_exposure(vol_score: int, concentration: int) -> str:
    if vol_score >= 60 or concentration < 40:
        return "High"
    if vol_score >= 42 or concentration < 60:
        return "Medium"
    return "Controlled"


def _severity(score: int) -> str:
    return "low" if score >= 70 else "medium" if score >= 45 else "high"


def _name_for_bucket(key: str, buckets: list[dict]) -> str:
    return next((bucket["bucketName"] for bucket in buckets if bucket["bucketKey"] == key), key)


def _target_payload(row: PortfolioTargetAllocation) -> dict:
    return {"bucketKey": row.bucket_key, "bucketName": row.bucket_name, "targetPercentage": row.target_percentage, "minPercentage": row.min_percentage, "maxPercentage": row.max_percentage, "expectedReturn": row.expected_return, "volatility": row.volatility, "riskLevel": row.risk_level, "rationale": row.rationale}


def _bucket_payload(row: PortfolioBucketAllocation) -> dict:
    return {"bucketKey": row.bucket_key, "bucketName": row.bucket_name, "currentValue": row.current_value, "currentPercentage": row.current_percentage, "targetValue": row.target_value, "targetPercentage": row.target_percentage, "gapValue": row.gap_value, "gapPercentage": row.gap_percentage, "monthlyContribution": row.monthly_contribution, "riskLevel": row.risk_level, "linkedGoals": _loads(row.linked_goals_json)}


def _metric_payload(row: PortfolioRiskMetric) -> dict:
    return {"metricName": row.metric_name, "score": row.score, "severity": row.severity, "explanation": row.explanation, "recommendation": row.recommendation}


def _suggestion_payload(row: PortfolioRebalancingSuggestion) -> dict:
    return {"priority": row.priority, "action": row.action, "bucketKey": row.bucket_key, "title": row.title, "explanation": row.explanation, "monthlyAmount": row.monthly_amount, "driftPercentage": row.drift_percentage, "riskImpact": row.risk_impact, "trigger": row.trigger}


def _loads(value: str) -> list:
    try:
        return json.loads(value or "[]")
    except json.JSONDecodeError:
        return []
