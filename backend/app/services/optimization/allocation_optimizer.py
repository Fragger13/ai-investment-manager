from __future__ import annotations

from app.schemas.financial import OnboardingProfile
from app.services.intelligence import net_worth, total_emi_payments
from app.services.optimization.correlation_service import overlap_warnings
from app.services.optimization.goal_based_allocation_service import linked_goals_for_bucket
from app.services.optimization.risk_model_service import BUCKET_ASSUMPTIONS, BUCKET_NAMES
from app.services.recommendations.suitability_scoring_service import ProfileContext


def current_bucket_values(profile: OnboardingProfile, context: ProfileContext) -> dict[str, int]:
    expenses = profile.monthlyExpenses + total_emi_payments(profile)
    emergency_need = max(expenses * 6, 0)
    emergency_cash = min(profile.cashBalance, emergency_need)
    remaining_cash = max(profile.cashBalance - emergency_cash, 0)
    additional_tactical = sum(item.value for item in profile.additionalInvestments if item.type.lower() in {"international stocks", "etfs", "etf", "esops", "rsus", "other"})
    additional_debt = sum(item.value for item in profile.additionalInvestments if item.type.lower() in {"bonds", "fixed deposits", "recurring deposits", "nps", "silver"})
    return {
        "emergency_reserve": emergency_cash,
        "core_long_term_wealth": profile.stocksValue + profile.mutualFundsValue + additional_tactical,
        "goal_specific_investments": profile.epfPpfValue + additional_debt,
        "tactical_opportunities": 0,
        "defensive_hedge": profile.goldValue,
        "crypto_high_risk": profile.cryptoValue,
        "cash_buffer": remaining_cash,
    }


def target_bucket_percentages(context: ProfileContext, goal_profile: dict, constraints: dict, regime: dict) -> dict[str, int]:
    risk_profile = constraints["riskProfile"]
    near_term = goal_profile["nearTermGoalCount"]
    essential_gap = goal_profile["essentialFundingGap"]
    regime_name = (regime.get("regimeName") or regime.get("regime") or "balanced").lower()
    base = {
        "emergency_reserve": 12,
        "core_long_term_wealth": 38,
        "goal_specific_investments": 22,
        "tactical_opportunities": 6,
        "defensive_hedge": 8,
        "crypto_high_risk": 2,
        "cash_buffer": 12,
    }
    if risk_profile == "defensive":
        base.update({"emergency_reserve": 20, "core_long_term_wealth": 24, "goal_specific_investments": 30, "tactical_opportunities": 2, "crypto_high_risk": 0, "cash_buffer": 16})
    elif risk_profile == "growth":
        base.update({"emergency_reserve": 8, "core_long_term_wealth": 48, "goal_specific_investments": 16, "tactical_opportunities": 10, "crypto_high_risk": 5, "cash_buffer": 5})
    elif risk_profile == "balanced_growth":
        base.update({"emergency_reserve": 10, "core_long_term_wealth": 44, "goal_specific_investments": 18, "tactical_opportunities": 8, "crypto_high_risk": 3, "cash_buffer": 7})

    if context.emergency_gap > 0:
        base["emergency_reserve"] += 8
        base["cash_buffer"] += 4
        base["tactical_opportunities"] = min(base["tactical_opportunities"], 3)
        base["crypto_high_risk"] = 0
        base["core_long_term_wealth"] -= 8
    if near_term:
        base["goal_specific_investments"] += min(near_term * 5, 12)
        base["core_long_term_wealth"] -= min(near_term * 4, 10)
    if essential_gap > context.net_worth:
        base["goal_specific_investments"] += 5
        base["tactical_opportunities"] = max(0, base["tactical_opportunities"] - 2)
    if regime_name in {"risk-off", "bear market", "high volatility"}:
        base["defensive_hedge"] += 4
        base["cash_buffer"] += 4
        base["tactical_opportunities"] = max(0, base["tactical_opportunities"] - 3)
        base["crypto_high_risk"] = max(0, base["crypto_high_risk"] - 2)
        base["core_long_term_wealth"] -= 3
    elif regime_name in {"risk-on", "bull market", "liquidity-driven", "momentum-led"}:
        base["core_long_term_wealth"] += 4
        base["tactical_opportunities"] += 2
        base["cash_buffer"] -= 3
    elif regime_name == "inflationary":
        base["defensive_hedge"] += 4
        base["goal_specific_investments"] += 2
        base["core_long_term_wealth"] -= 3

    base["tactical_opportunities"] = min(base["tactical_opportunities"], constraints["tacticalAllocationCap"])
    base["crypto_high_risk"] = min(base["crypto_high_risk"], constraints["cryptoAllocationCap"])
    for bucket, assumption in BUCKET_ASSUMPTIONS.items():
        base[bucket] = max(assumption["min"], min(assumption["max"], round(base.get(bucket, 0))))
    return _normalize(base)


def bucket_allocations(profile: OnboardingProfile, context: ProfileContext, goals: list[dict], targets: dict[str, int]) -> list[dict]:
    worth = max(net_worth(profile), 1)
    current_values = current_bucket_values(profile, context)
    current_pct = {key: round(value / worth * 100) for key, value in current_values.items()}
    total_positive_gap = sum(max(targets[key] - current_pct.get(key, 0), 0) for key in targets) or 1
    rows = []
    for key, target_pct in targets.items():
        current_value = current_values.get(key, 0)
        target_value = round(worth * target_pct / 100)
        gap_value = target_value - current_value
        gap_pct = target_pct - current_pct.get(key, 0)
        monthly = round(context.surplus * max(gap_pct, 0) / total_positive_gap) if context.surplus > 0 else 0
        rows.append(
            {
                "bucketKey": key,
                "bucketName": BUCKET_NAMES[key],
                "currentValue": current_value,
                "currentPercentage": current_pct.get(key, 0),
                "targetValue": target_value,
                "targetPercentage": target_pct,
                "gapValue": gap_value,
                "gapPercentage": gap_pct,
                "monthlyContribution": monthly,
                "riskLevel": BUCKET_ASSUMPTIONS[key]["risk"],
                "linkedGoals": linked_goals_for_bucket(key, goals),
            }
        )
    return rows


def target_rows(targets: dict[str, int]) -> list[dict]:
    warnings = overlap_warnings(targets)
    rows = []
    for key, target in targets.items():
        assumption = BUCKET_ASSUMPTIONS[key]
        rows.append(
            {
                "bucketKey": key,
                "bucketName": BUCKET_NAMES[key],
                "targetPercentage": target,
                "minPercentage": assumption["min"],
                "maxPercentage": assumption["max"],
                "expectedReturn": assumption["return"],
                "volatility": assumption["volatility"],
                "riskLevel": assumption["risk"],
                "rationale": _rationale(key, warnings),
            }
        )
    return rows


def _rationale(bucket_key: str, warnings: list[str]) -> str:
    base = {
        "emergency_reserve": "Protects essential expenses before you take more investment risk.",
        "core_long_term_wealth": "Builds long-term wealth for retirement and other future goals.",
        "goal_specific_investments": "Sets aside money for important goals based on when you will need it.",
        "tactical_opportunities": "Keeps short-term ideas small and separate from your main plan.",
        "defensive_hedge": "Uses gold and steadier investments to avoid depending only on shares.",
        "crypto_high_risk": "Keeps optional higher-risk investments small and suitable for your situation.",
        "cash_buffer": "Keeps extra money available for upcoming needs and gradual investing.",
    }[bucket_key]
    return f"{base} {' '.join(warnings)}".strip()


def _normalize(values: dict[str, int]) -> dict[str, int]:
    total = sum(max(value, 0) for value in values.values()) or 1
    normalized = {key: round(max(value, 0) / total * 100) for key, value in values.items()}
    bounded = {
        key: max(BUCKET_ASSUMPTIONS[key]["min"], min(BUCKET_ASSUMPTIONS[key]["max"], value))
        for key, value in normalized.items()
    }
    drift = 100 - sum(bounded.values())
    adjustment_order = [
        "cash_buffer",
        "core_long_term_wealth",
        "goal_specific_investments",
        "defensive_hedge",
        "emergency_reserve",
        "tactical_opportunities",
        "crypto_high_risk",
    ]
    while drift != 0:
        moved = False
        for key in adjustment_order:
            assumption = BUCKET_ASSUMPTIONS[key]
            if drift > 0:
                capacity = assumption["max"] - bounded[key]
                step = min(drift, max(0, capacity))
                bounded[key] += step
                drift -= step
            else:
                capacity = bounded[key] - assumption["min"]
                step = min(abs(drift), max(0, capacity))
                bounded[key] -= step
                drift += step
            moved = moved or step > 0
            if drift == 0:
                break
        if not moved:
            break
    return bounded
