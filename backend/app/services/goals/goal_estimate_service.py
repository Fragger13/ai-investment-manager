"""Orchestrates the hybrid goal-amount estimate: deterministic baseline →
optional LLM refinement (clamped to the baseline's band) → a single figure with
its source. Never raises; falls back to the deterministic number."""
from __future__ import annotations

from typing import Any

from app.services.goals.goal_estimator import (
    CALCULATOR_ONLY_GOAL_TYPES,
    band_for,
    clamp_loose,
    clamp_to_band,
    estimate_goal,
)
from app.services.llm.model_router import refine_goal_estimate

# Free-form goals: the LLM sets the figure from the description, so don't pin it
# to a cost-table band — a budget watch and a luxury watch must both be allowed.
_LOOSE_CLAMP_GOAL_TYPES = frozenset({"Other"})


def _compact_profile(profile: dict[str, Any] | None) -> dict[str, Any]:
    p = profile or {}
    income = (
        p.get("monthlyCashInflow")
        or (int(p.get("monthlySalary") or 0) + int(p.get("otherIncome") or 0))
        or p.get("monthlyIncome")
    )
    return {"city": p.get("city"), "occupation": p.get("occupation"), "monthlyIncome": income}


def estimate_goal_amount(
    goal_type: str,
    answers: dict[str, Any] | None,
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    answers = answers or {}
    baseline = estimate_goal(goal_type, answers, profile)

    # Profile-derived goals are already exact from the user's own numbers — return
    # the calculator figure directly and skip the LLM.
    if goal_type in CALCULATOR_ONLY_GOAL_TYPES:
        return {**baseline, "source": "calculator"}

    try:
        refined, meta = refine_goal_estimate(goal_type, answers, _compact_profile(profile), baseline)
    except Exception:  # noqa: BLE001 — onboarding must never break on an LLM hiccup
        refined, meta = baseline, {"llm_enhanced": False}

    if meta.get("llm_enhanced") and isinstance(refined, dict) and refined.get("amount"):
        if goal_type in _LOOSE_CLAMP_GOAL_TYPES:
            amount = clamp_loose(refined.get("amount"))
        else:
            amount = clamp_to_band(refined.get("amount"), baseline["low"], baseline["high"])
        low, high = band_for(amount)
        rationale = str(refined.get("rationale") or "").strip() or baseline["rationale"]
        source = "ai"
    else:
        amount = baseline["amount"]
        low, high = baseline["low"], baseline["high"]
        rationale = baseline["rationale"]
        source = "calculator"

    return {
        "amount": amount,
        "low": low,
        "high": high,
        "rationale": rationale,
        "assumptions": baseline.get("assumptions", []),
        "source": source,
    }
