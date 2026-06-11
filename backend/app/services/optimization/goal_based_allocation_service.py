from __future__ import annotations

from app.schemas.financial import OnboardingProfile
from app.services.intelligence import goal_display_name, months_until


def goal_allocation_profile(profile: OnboardingProfile) -> dict:
    goals = []
    for goal in profile.goals:
        months = months_until(goal.targetDate, 60)
        essential = goal.type in {"Emergency fund", "Debt repayment", "Retirement", "Child education", "Higher education"}
        goals.append(
            {
                "name": goal_display_name(goal),
                "type": goal.type or "Goal",
                "priority": goal.priority or 99,
                "targetAmount": goal.targetAmount,
                "currentAmount": goal.currentAmount,
                "months": months,
                "horizon": "near_term" if months <= 36 else "medium_term" if months <= 84 else "long_term",
                "essential": essential,
                "fundingGap": max(goal.targetAmount - goal.currentAmount, 0),
            }
        )
    goals.sort(key=lambda item: (item["priority"], item["months"]))
    near_term = sum(1 for goal in goals if goal["horizon"] == "near_term")
    essential_gap = sum(goal["fundingGap"] for goal in goals if goal["essential"])
    aspirational_gap = sum(goal["fundingGap"] for goal in goals if not goal["essential"])
    return {
        "goals": goals,
        "nearTermGoalCount": near_term,
        "essentialFundingGap": essential_gap,
        "aspirationalFundingGap": aspirational_gap,
        "topGoals": goals[:3],
    }


def linked_goals_for_bucket(bucket_key: str, goals: list[dict]) -> list[dict]:
    if bucket_key == "emergency_reserve":
        matches = [goal for goal in goals if goal["type"] == "Emergency fund"]
    elif bucket_key == "core_long_term_wealth":
        matches = [goal for goal in goals if goal["horizon"] == "long_term"]
    elif bucket_key == "goal_specific_investments":
        matches = [goal for goal in goals if goal["essential"] or goal["horizon"] in {"near_term", "medium_term"}]
    elif bucket_key == "tactical_opportunities":
        matches = [goal for goal in goals if not goal["essential"] and goal["horizon"] != "near_term"]
    elif bucket_key == "crypto_high_risk":
        matches = [goal for goal in goals if not goal["essential"] and goal["horizon"] == "long_term"]
    else:
        matches = goals[:3]
    return [{"name": goal["name"], "priority": goal["priority"], "horizon": goal["horizon"]} for goal in matches[:3]]

