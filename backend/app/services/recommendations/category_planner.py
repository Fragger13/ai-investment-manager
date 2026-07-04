"""Per-profile fund-category plan: which categories fit this user, in what order.

The screening layer produces one global asset list (a liquid fund, a flexi-cap
fund, an ELSS, ...). Before this planner, every user walked that same list and
only the per-class COUNTS differed, so two users in the same risk band received
near-identical instrument sets — a student with no tax liability was even shown
an ELSS with a 3-year lock-in.

build_category_plan() turns the user's ProfileContext into a deterministic
preference score per fund category. Scores order which categories fill the
per-class slots (higher first); a negative score excludes the category
entirely. Pure quant gating — no randomness — so the same profile always gets
the same plan, different profiles get genuinely different ones, and the LLM
still only explains what the quant layer decided.
"""

from __future__ import annotations

from app.services.recommendations.suitability_scoring_service import ProfileContext

# Neutral preference for anything the planner has no opinion about
# (stocks, crypto, unknown categories). Fund categories score around this.
NEUTRAL_PREFERENCE = 50.0

# Monthly income above which ELSS tax planning is worth the 3-year lock-in.
# Below roughly ₹1L/month the new tax regime leaves little or no 80C benefit.
_ELSS_INCOME_FLOOR = 100_000

# Under this invested corpus (or without a monthly investing habit) the user
# is treated as a beginner: simple, forgiving categories before satellites.
_BEGINNER_CORPUS = 100_000


def is_beginner(context: ProfileContext) -> bool:
    return context.investments_total < _BEGINNER_CORPUS or not context.invest_monthly_active


def build_category_plan(context: ProfileContext) -> dict[str, float]:
    beginner = is_beginner(context)
    conservative = not context.long_term_growth_ok
    young = context.age_band == "young"
    mid_age = context.age_band == "mid"
    pre_retire = context.age_band == "pre_retire"
    senior = context.age_band == "senior"
    high_income = context.income_tier in {"high", "ultra"}
    emergency_covered = context.emergency_gap <= 0

    plan: dict[str, float] = {}

    # ---- equity ------------------------------------------------------------
    plan["large_cap_index"] = 70 + (15 if beginner else 0) + (10 if context.panic_risk else 0) \
        - (10 if (not beginner and context.long_term_growth_ok and context.investments_total > 1_000_000) else 0)

    plan["flexi_cap"] = 75 + (10 if not beginner else -5)

    if senior or (context.panic_risk and conservative):
        plan["mid_cap"] = -1
    else:
        plan["mid_cap"] = 55 + (15 if (context.long_term_growth_ok and (young or mid_age)) else 0) \
            - (15 if pre_retire else 0) - (10 if conservative else 0)

    if beginner or context.panic_risk or conservative or senior or (pre_retire and not context.long_term_growth_ok):
        plan["small_cap"] = -1
    else:
        plan["small_cap"] = 40 + (15 if young else 5 if mid_age else 0)

    if context.income < _ELSS_INCOME_FLOOR:
        plan["elss"] = -1
    else:
        plan["elss"] = 50 + (15 if context.disciplined else 0)

    plan["hybrid"] = 60 + (15 if (context.panic_risk or not context.short_term_risk_ok) else 0) \
        + (10 if (pre_retire or senior) else 0) - (10 if (young and context.long_term_growth_ok and not beginner) else 0)

    # ---- debt --------------------------------------------------------------
    plan["liquid"] = 75 + (20 if not emergency_covered else 0) + (10 if context.irregular_income else 0)
    plan["overnight"] = 45 + (10 if (not emergency_covered and context.surplus > 100_000) else 0)
    plan["short_duration"] = 65 + (10 if context.has_short_term_goals else 0)
    plan["gilt"] = 40 + (20 if (pre_retire or senior) else 0) + (10 if conservative else 0) - (10 if beginner else 0)
    plan["corporate_bond"] = 45 + (15 if (emergency_covered and (mid_age or pre_retire)) else 0) + (5 if high_income else 0)
    plan["banking_psu"] = 40 + (10 if conservative else 0)
    plan["arbitrage"] = 35 + (20 if (high_income and emergency_covered) else 0) + (10 if context.irregular_income else 0)

    # ---- gold --------------------------------------------------------------
    if context.portfolio_gold_share > 0.15:
        plan["gold"] = 30  # already heavy on gold; keep it possible but last
    else:
        plan["gold"] = 55 + (10 if context.portfolio_gold_share < 0.05 else 0)

    return plan


def category_preference(plan: dict[str, float], category_key: str | None) -> float:
    """Preference for a screened asset; non-fund assets stay neutral."""
    if not category_key:
        return NEUTRAL_PREFERENCE
    return plan.get(category_key, NEUTRAL_PREFERENCE)
