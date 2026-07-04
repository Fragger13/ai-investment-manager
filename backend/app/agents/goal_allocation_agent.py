from __future__ import annotations

from app.schemas.financial import OnboardingProfile
from app.services.intelligence import calculated_goal_target, emergency_target_base, months_until, total_emi_payments


ESSENTIAL_GOALS = {"Emergency fund", "Debt repayment", "Child education", "Higher education", "Retirement"}


def build_goal_hierarchy(profile: OnboardingProfile) -> list[dict]:
    goals = []
    for index, goal in enumerate(profile.goals):
        target = calculated_goal_target(goal)
        current = int(goal.currentAmount or goal.downPayment or 0)
        months = months_until(goal.targetDate, _default_months(goal.type))
        funding_gap = max(target - current, 0)
        goal_type = goal.type or "Other"
        name = goal.customName.strip() if goal_type == "Other" and goal.customName.strip() else goal_type
        goals.append(
            {
                "name": name,
                "type": goal_type,
                "priority": goal.priority or index + 1,
                "targetAmount": target,
                "currentAmount": current,
                "fundingGap": funding_gap,
                "timeHorizonMonths": months,
                "horizonBucket": _horizon_bucket(months),
                "essential": goal_type in ESSENTIAL_GOALS,
                "aspirational": goal_type not in ESSENTIAL_GOALS,
                "paymentStyle": goal.paymentStyle,
                "monthlyContribution": goal.monthlyContribution,
                "eligibleAssetKeys": _eligible_asset_keys(goal_type, months),
            }
        )
    if goals:
        return sorted(goals, key=lambda item: (item["priority"], item["timeHorizonMonths"]))

    emergency_target = max(profile.emergencyFundTarget or 0, emergency_target_base(profile))
    return [
        {
            "name": "Emergency fund",
            "type": "Emergency fund",
            "priority": 1,
            "targetAmount": emergency_target,
            "currentAmount": profile.cashBalance,
            "fundingGap": max(emergency_target - profile.cashBalance, 0),
            "timeHorizonMonths": 6,
            "horizonBucket": "near-term",
            "essential": True,
            "aspirational": False,
            "paymentStyle": "lumpsum",
            "monthlyContribution": 0,
            "eligibleAssetKeys": ["debt"],
        }
    ]


def select_goal_for_asset(asset_key: str, goals: list[dict]) -> dict:
    eligible = [goal for goal in goals if asset_key in goal["eligibleAssetKeys"]]
    if eligible:
        return sorted(eligible, key=lambda item: (item["priority"], item["timeHorizonMonths"]))[0]
    return sorted(goals, key=lambda item: (item["priority"], item["timeHorizonMonths"]))[0]


def _eligible_asset_keys(goal_type: str, months: int) -> list[str]:
    if goal_type in {"Emergency fund", "Debt repayment"} or months <= 36:
        return ["debt"]
    if months <= 84:
        return ["debt", "gold", "equity"]
    if goal_type in {"Business/startup", "Wealth creation", "Other"}:
        return ["equity", "gold", "debt", "crypto", "tactical"]
    return ["equity", "debt", "gold", "tactical"]


def _horizon_bucket(months: int) -> str:
    if months <= 36:
        return "near-term"
    if months <= 84:
        return "medium-term"
    return "long-term"


def _default_months(goal_type: str) -> int:
    if goal_type in {"Emergency fund", "Debt repayment"}:
        return 6
    if goal_type in {"Travel", "Car purchase"}:
        return 24
    if goal_type in {"House purchase", "Higher education", "Marriage", "Business/startup"}:
        return 60
    return 120
