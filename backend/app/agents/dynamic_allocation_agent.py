from __future__ import annotations


def dynamic_allocation_summary(optimization: dict) -> dict:
    summary = optimization.get("summary", {})
    return {
        "targetAllocation": optimization.get("targetAllocation", []),
        "monthlyDeploymentPlan": optimization.get("monthlyDeploymentPlan", []),
        "regimeAdjustments": optimization.get("regimeAdjustments", []),
        "summary": (
            f"The suggested mix uses your {summary.get('riskProfile', 'balanced')} comfort with risk, "
            f"current {summary.get('marketRegime', 'balanced')} market conditions, and a {summary.get('allocationDrift', 0)}% difference from your current mix."
        ),
    }
