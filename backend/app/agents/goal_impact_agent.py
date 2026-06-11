from __future__ import annotations

from typing import Any


def attach_goal_impacts(recommendation: dict[str, Any]) -> dict[str, Any]:
    linked_goals = recommendation.get("linkedGoals") or []
    monthly_amount = max(int(recommendation.get("suggestedMonthlyAmount") or 0), 0)
    action = str(recommendation.get("action") or "accumulate").lower()
    impacts = []

    for goal in linked_goals[:3]:
        months = max(int(goal.get("timeHorizonMonths") or 1), 1)
        funding_gap = max(int(goal.get("fundingGap") or 0), 0)
        monthly_need = max(round(funding_gap / months), 1)
        planning_impact = min(25, max(1, round(monthly_amount / monthly_need * 100))) if monthly_amount else 0
        direction = "negative" if action in {"avoid", "reduce", "exit"} else "positive"
        sign = "-" if direction == "negative" else "+"
        impacts.append(
            {
                "goalName": goal.get("name") or "Your goal",
                "priority": int(goal.get("priority") or 0),
                "impactPercent": planning_impact,
                "direction": direction,
                "label": f"{sign}{planning_impact}%",
                "explanation": _impact_explanation(goal, monthly_amount, planning_impact, direction),
            }
        )

    recommendation["goalImpacts"] = impacts
    recommendation["goalImpactSummary"] = (
        impacts[0]["explanation"]
        if impacts
        else "This idea is not tied to a specific saved goal yet. Keep it secondary to your priority goals."
    )
    return recommendation


def _impact_explanation(goal: dict[str, Any], monthly_amount: int, impact: int, direction: str) -> str:
    name = goal.get("name") or "your goal"
    priority = int(goal.get("priority") or 0)
    if direction == "negative":
        return f"This change may reduce progress toward P{priority} {name}; review the goal contribution before reducing it."
    if monthly_amount <= 0:
        return f"This idea supports P{priority} {name}, but no monthly amount has been suggested yet."
    return f"About {monthly_amount:,.0f} per month could cover roughly {impact}% of the current monthly funding need for P{priority} {name}."
