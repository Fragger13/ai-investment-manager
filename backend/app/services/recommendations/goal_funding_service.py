"""Goal-funding solver.

Turns recommendations into a plan that, *if followed*, actually reaches the
user's goals. For each goal it computes the monthly SIP required to hit the
target by its date using a future-value-of-SIP projection (compounding — unlike
the linear `intelligence.goal_agent` estimate), allocates the user's investable
surplus essential/priority-first, and reports an honest funding % with concrete
fixes when the surplus cannot fully fund everything.

The per-goal monthly SIP it produces is the budget the recommendation engine
sizes fund SIPs against, so the suggested investments ladder up to the goals.
"""

from __future__ import annotations

from math import ceil

from app.schemas.financial import OnboardingProfile, ProfileGoal
from app.services.intelligence import (
    calculated_goal_target,
    goal_display_name,
    investable_surplus,
    monthly_income,
    months_until,
    net_worth,
    total_emi_payments,
)

# Essential goal types get first claim on surplus.
_ESSENTIAL_TYPES = {"emergency fund", "retirement", "retirement plan", "health", "education", "child"}
_LONG_TERM_TYPES = {"retirement", "retirement plan", "financial freedom", "wealth creation", "freedom"}


def _expected_annual_for_months(months: int) -> float:
    """Horizon-appropriate expected return (annual %) for FV projection."""
    if months <= 36:
        return 6.5   # near-term → debt-like
    if months <= 84:
        return 10.0  # medium → hybrid
    return 12.0      # long → equity


def required_sip(target: int, current: int, months: int, annual_return: float) -> int:
    """Monthly SIP to reach ``target`` from ``current`` in ``months`` at a rate."""
    if target <= current:
        return 0
    if months <= 0:
        return max(target - current, 0)
    r = (1 + annual_return / 100) ** (1 / 12) - 1
    grown_current = current * ((1 + r) ** months)
    remaining = target - grown_current
    if remaining <= 0:
        return 0
    if r <= 0:
        return ceil(remaining / months)
    annuity_factor = ((1 + r) ** months - 1) / r
    return ceil(remaining / annuity_factor)


def projected_corpus(current: int, sip: float, months: int, annual_return: float) -> float:
    if months <= 0:
        return float(current)
    r = (1 + annual_return / 100) ** (1 / 12) - 1
    fv_current = current * ((1 + r) ** months)
    fv_sip = sip * (((1 + r) ** months - 1) / r) if r > 0 else sip * months
    return fv_current + fv_sip


def _months_to_target(target: int, current: int, sip: float, annual_return: float, cap: int = 600) -> int:
    """Smallest months for which projected corpus >= target at this SIP."""
    if sip <= 0 and current <= 0:
        return cap
    for m in range(1, cap + 1):
        if projected_corpus(current, sip, m, annual_return) >= target:
            return m
    return cap


def _is_essential(goal: ProfileGoal) -> bool:
    return (goal.type or "").strip().lower() in _ESSENTIAL_TYPES


def _goal_current(goal: ProfileGoal, worth: int) -> int:
    """Corpus already standing toward the goal."""
    base = int(goal.currentAmount or goal.downPayment or 0)
    if (goal.type or "").strip().lower() in _LONG_TERM_TYPES:
        # Long-term goals draw on existing net worth.
        return base + max(worth, 0)
    return base


def solve_goal_funding(
    profile: OnboardingProfile,
    returns_by_goal_id: dict[str, float] | None = None,
) -> dict:
    """Allocate surplus across goals and report funding status per goal.

    ``returns_by_goal_id`` optionally overrides the horizon-default expected
    return (e.g. with the factor-derived estimate of the fund chosen for that
    goal's sleeve).
    """
    returns_by_goal_id = returns_by_goal_id or {}
    income = monthly_income(profile)
    emi_total = total_emi_payments(profile)
    computed_surplus = max(income - profile.monthlyExpenses - emi_total, 0)
    surplus = investable_surplus(profile, computed_surplus)
    worth = net_worth(profile)

    goals = list(profile.goals or [])
    if not goals:
        return {
            "goals": [],
            "surplus": surplus,
            "totalRequired": 0,
            "totalAllocated": 0,
            "fullyFundsAll": True,
            "sipByGoalId": {},
        }

    # Emergency fund always gets first claim on surplus; otherwise respect the
    # user's explicit priority ranking, with essential as a tiebreaker.
    def _order_key(g: ProfileGoal):
        is_emergency = (g.type or "").strip().lower().startswith("emergency")
        return (0 if is_emergency else 1, g.priority or 999, 0 if _is_essential(g) else 1, goal_display_name(g))

    ordered = sorted(goals, key=_order_key)

    plans: list[dict] = []
    sip_by_goal: dict[str, float] = {}
    remaining = surplus
    total_required = 0

    for index, goal in enumerate(ordered):
        name = goal_display_name(goal)
        slug = name.lower().replace("/", "-").replace(" ", "-")
        goal_id = f"goal-{goal.priority or index + 1}-{slug}"
        target = calculated_goal_target(goal)
        current = _goal_current(goal, worth)
        months = months_until(goal.targetDate, 6 if (goal.type or "").lower().startswith("emergency") else 60)
        annual_return = returns_by_goal_id.get(goal_id) or _expected_annual_for_months(months)

        req = required_sip(target, current, months, annual_return)
        total_required += req
        allocated = min(req, remaining)
        remaining -= allocated
        sip_by_goal[goal_id] = allocated

        corpus = projected_corpus(current, allocated, months, annual_return)
        funding_pct = round(min(100, (corpus / target * 100))) if target > 0 else 100
        gap = max(req - allocated, 0)
        on_track = funding_pct >= 98

        fix = ""
        if not on_track and target > 0:
            if gap > 0:
                months_at_alloc = _months_to_target(target, current, allocated, annual_return)
                extra_years = max(0, round((months_at_alloc - months) / 12, 1)) if allocated > 0 else None
                if extra_years:
                    fix = f"Add ₹{gap:,}/mo, or keep ₹{allocated:,}/mo and extend the timeline by ~{extra_years} years."
                else:
                    fix = f"Add ₹{gap:,}/mo to fully fund this on time (surplus is exhausted by higher-priority goals)."
            else:
                fix = "On track once funded for the full horizon."

        plans.append(
            {
                "id": goal_id,
                "name": name,
                "priority": goal.priority or index + 1,
                "essential": _is_essential(goal),
                "targetAmount": target,
                "currentProgress": current,
                "timeHorizonMonths": months,
                "expectedReturn": annual_return,
                "requiredMonthlyInvestment": req,
                "allocatedMonthlyInvestment": allocated,
                "projectedCorpus": round(corpus),
                "fundingPercent": funding_pct,
                "gap": gap,
                "onTrack": on_track,
                "fix": fix,
            }
        )

    return {
        "goals": plans,
        "surplus": surplus,
        "totalRequired": total_required,
        "totalAllocated": surplus - remaining,
        "unallocatedSurplus": max(remaining, 0),
        "fullyFundsAll": all(p["onTrack"] for p in plans),
        "sipByGoalId": sip_by_goal,
    }
