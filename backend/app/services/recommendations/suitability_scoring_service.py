"""Production-grade personalization for recommendation suitability.

The previous version used 3 hard-coded branches (`emergency_gap > 0` /
`long_term_growth_ok` / default) which gave near-identical allocations to
users with the same surplus but different age, goals, behavior or
existing portfolios. This rewrite layers multiple signals so each user
gets a distinct allocation tilt:

  base = age-based glide path        (younger → more equity, older → more debt)
  + goal overlay                     (short-horizon goals → tilt to debt; long → tilt to equity)
  + behavioral overlay               (panic-seller caps equity; disciplined unlocks more tactical)
  + existing-portfolio rebalance     (already overweight equity? reduce; underweight debt? bump)
  + income-tier overlay              (high earners can take more tactical/crypto; lower earners locked to core)
  + emergency-gap guardrail          (always biases debt until emergency cover is built)

Suitability and confidence scoring also factor age, goal fit, portfolio gap
and behavioral signals, so different profiles see different recommendations.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.schemas.financial import OnboardingProfile, ProfileGoal
from app.services.intelligence import (
    calculate_age,
    computed_monthly_surplus,
    emergency_target_base,
    investable_surplus,
    monthly_income,
    net_worth,
    total_emi_payments,
)
from app.services.recommendations.asset_screening_service import ResearchAsset


# ---------------------------------------------------------------------------
# Profile context
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProfileContext:
    age: int
    income: int
    surplus: int
    net_worth: int
    emergency_gap: int
    savings_rate: float
    equity_value: int
    debt_like_value: int
    gold_value: int
    crypto_value: int
    long_term_growth_ok: bool
    short_term_risk_ok: bool
    panic_risk: bool
    disciplined: bool
    has_short_term_goals: bool
    has_long_term_goals: bool
    short_term_goal_share: float
    long_term_goal_share: float
    income_tier: str  # "low" | "mid" | "high" | "ultra"
    age_band: str  # "young" | "mid" | "pre_retire" | "senior"
    irregular_income: bool
    invest_monthly_active: bool
    portfolio_equity_share: float
    portfolio_debt_share: float
    portfolio_gold_share: float
    portfolio_crypto_share: float
    investments_total: int
    goal_count: int


def build_profile_context(profile: OnboardingProfile) -> ProfileContext:
    income = monthly_income(profile)
    emi_total = total_emi_payments(profile)
    # Same "available to invest" the dashboard shows: income minus ALL fixed
    # commitments (rent + expenses + subscriptions + EMIs), respecting the
    # user's explicit this-month override when it applies.
    surplus = investable_surplus(profile, computed_monthly_surplus(profile))
    emergency_goal = next((goal for goal in profile.goals if goal.type == "Emergency fund"), None)
    emergency_target = max(
        emergency_goal.targetAmount if emergency_goal else profile.emergencyFundTarget or 0,
        emergency_target_base(profile),
    )
    emergency_gap = max(emergency_target - profile.cashBalance, 0)
    savings_rate = (surplus / income * 100) if income else 0

    additional_equity = sum(
        item.value
        for item in profile.additionalInvestments
        if item.type.lower() in {"etf", "international stocks", "esops", "rsus", "stocks"}
    )
    equity_value = profile.stocksValue + profile.mutualFundsValue + additional_equity
    debt_like_value = profile.epfPpfValue + sum(
        item.value
        for item in profile.additionalInvestments
        if item.type.lower() in {"bonds", "fixed deposits", "recurring deposits", "nps", "sovereign gold bonds"}
    )

    age = calculate_age(profile.dateOfBirth, profile.age)
    long_term_growth_ok = (
        profile.volatilityComfort == "High"
        or profile.investmentHorizon in {"7-10 years", "10+ years"}
        or age < 40
    )
    short_term_risk_ok = (
        profile.shortTermVolatilityComfort == "High"
        and profile.shortTermLossTolerance in {"10-15%", "15%+"}
    )
    panic_risk = (
        profile.riskReaction in {"Panic sell", "I may sell"}
        or profile.panicSellRisk in {"Yes", "Often"}
    )
    disciplined = (
        profile.investsMonthly in {"Yes", "Always", "Often"}
        and profile.spendingDiscipline in {"Strong", "Good", "High"}
    )

    # Goal mix breakdown — short-term (≤3y) vs long-term (>5y).
    short_term_goal_share, long_term_goal_share, has_short_term_goals, has_long_term_goals = _goal_horizon_shares(profile.goals or [])

    income_tier = _income_tier(income)
    age_band = _age_band(age)

    invest_monthly_active = profile.investsMonthly in {"Yes", "Always", "Often", "Sometimes"}
    # investingBlocker may be a ", "-joined multi-select, so match anywhere in it.
    irregular_income = "irregular" in (profile.investingBlocker or "").lower()

    investments_total = (
        profile.stocksValue
        + profile.mutualFundsValue
        + profile.cryptoValue
        + profile.goldValue
        + profile.epfPpfValue
        + profile.realEstateValue
        + sum(item.value for item in profile.additionalInvestments)
    )
    total_for_share = max(investments_total, 1)
    portfolio_equity_share = equity_value / total_for_share
    portfolio_debt_share = debt_like_value / total_for_share
    portfolio_gold_share = profile.goldValue / total_for_share
    portfolio_crypto_share = profile.cryptoValue / total_for_share

    return ProfileContext(
        age=age,
        income=income,
        surplus=surplus,
        net_worth=net_worth(profile),
        emergency_gap=emergency_gap,
        savings_rate=savings_rate,
        equity_value=equity_value,
        debt_like_value=debt_like_value,
        gold_value=profile.goldValue,
        crypto_value=profile.cryptoValue,
        long_term_growth_ok=long_term_growth_ok,
        short_term_risk_ok=short_term_risk_ok,
        panic_risk=panic_risk,
        disciplined=disciplined,
        has_short_term_goals=has_short_term_goals,
        has_long_term_goals=has_long_term_goals,
        short_term_goal_share=short_term_goal_share,
        long_term_goal_share=long_term_goal_share,
        income_tier=income_tier,
        age_band=age_band,
        irregular_income=irregular_income,
        invest_monthly_active=invest_monthly_active,
        portfolio_equity_share=portfolio_equity_share,
        portfolio_debt_share=portfolio_debt_share,
        portfolio_gold_share=portfolio_gold_share,
        portfolio_crypto_share=portfolio_crypto_share,
        investments_total=investments_total,
        goal_count=len(profile.goals or []),
    )


# ---------------------------------------------------------------------------
# Target allocation — multi-factor glide path
# ---------------------------------------------------------------------------


def target_allocation(asset_key: str, context: ProfileContext) -> int:
    """Return the % of monthly surplus to direct toward this asset bucket.

    Combines: age-based glide path + goal overlay + behavioral overlay +
    existing-portfolio rebalance + income tier + emergency guardrail.
    """
    if context.surplus <= 0:
        return 0
    if asset_key not in {"debt", "equity", "gold", "crypto", "tactical"}:
        return 0

    # ---- 1. Age-based base allocation (classic glide path) -----------------
    if context.age_band == "young":      # < 30
        base = {"equity": 60, "debt": 20, "gold": 8, "crypto": 5, "tactical": 7}
    elif context.age_band == "mid":      # 30-44
        base = {"equity": 55, "debt": 25, "gold": 10, "crypto": 3, "tactical": 7}
    elif context.age_band == "pre_retire":  # 45-59
        base = {"equity": 40, "debt": 40, "gold": 12, "crypto": 1, "tactical": 7}
    else:                                  # 60+
        base = {"equity": 25, "debt": 55, "gold": 15, "crypto": 0, "tactical": 5}

    allocation = dict(base)

    # ---- 2. Goal overlay (short-term tilts debt, long-term tilts equity) --
    if context.has_short_term_goals and context.short_term_goal_share > 0.4:
        allocation["debt"] += 8
        allocation["equity"] -= 6
        allocation["crypto"] = max(0, allocation["crypto"] - 2)
    if context.has_long_term_goals and context.long_term_goal_share > 0.4:
        allocation["equity"] += 5
        allocation["debt"] = max(10, allocation["debt"] - 4)
    if context.goal_count == 0:
        # No goals → bias toward defensive until user adds goals
        allocation["debt"] += 5
        allocation["equity"] -= 5

    # ---- 3. Behavioral overlay --------------------------------------------
    if context.panic_risk:
        allocation["equity"] = max(20, allocation["equity"] - 10)
        allocation["debt"] += 6
        allocation["tactical"] = max(0, allocation["tactical"] - 4)
        allocation["crypto"] = max(0, allocation["crypto"] - 2)
    if context.disciplined:
        # Disciplined investors get a small unlock for tactical
        allocation["tactical"] += 3
        allocation["equity"] += 2
    if not context.invest_monthly_active:
        # Inconsistent investor — favor automation-friendly buckets
        allocation["debt"] += 4
        allocation["tactical"] = max(0, allocation["tactical"] - 3)
    if context.irregular_income:
        allocation["debt"] += 6
        allocation["equity"] -= 4
        allocation["tactical"] = max(0, allocation["tactical"] - 2)

    # ---- 4. Existing-portfolio rebalance ----------------------------------
    # If user is already heavily skewed toward one bucket, send less new money
    # there. If they are underweight a core bucket, bump it.
    if context.portfolio_equity_share > 0.65:
        allocation["equity"] = max(10, allocation["equity"] - 12)
        allocation["debt"] += 6
        allocation["gold"] += 3
    elif context.portfolio_equity_share < 0.15 and context.age_band in {"young", "mid"}:
        allocation["equity"] += 6
        allocation["debt"] = max(15, allocation["debt"] - 4)
    if context.portfolio_debt_share > 0.55 and context.age_band in {"young", "mid"}:
        allocation["debt"] = max(15, allocation["debt"] - 10)
        allocation["equity"] += 8
    if context.portfolio_gold_share > 0.12:
        allocation["gold"] = max(0, allocation["gold"] - 6)
        allocation["equity"] += 3
    if context.portfolio_crypto_share > 0.05:
        allocation["crypto"] = 0  # already at cap
        allocation["debt"] += 2

    # ---- 5. Income-tier overlay -------------------------------------------
    if context.income_tier == "low":
        # Low earners — concentrate on core, kill all tactical/crypto
        allocation["tactical"] = max(0, allocation["tactical"] - 6)
        allocation["crypto"] = 0
        allocation["debt"] += 4
    elif context.income_tier == "ultra":
        # Top earners — small tactical/crypto unlock if disciplined + not panic
        if context.disciplined and not context.panic_risk:
            allocation["tactical"] += 3
            allocation["crypto"] += 2

    # ---- 6. Emergency-gap guardrail (overrides upside on equity/tactical) --
    if context.emergency_gap > 0:
        # Bias heavily into debt until emergency fund is built
        gap_severity = min(1.0, context.emergency_gap / max(context.income * 6, 1))
        debt_boost = round(20 * gap_severity)
        allocation["debt"] = min(70, allocation["debt"] + debt_boost)
        allocation["equity"] = max(15, allocation["equity"] - debt_boost // 2)
        allocation["tactical"] = max(0, allocation["tactical"] - 4)
        allocation["crypto"] = max(0, allocation["crypto"] - 1)

    # ---- 7. Hard caps for risky assets ------------------------------------
    if not context.short_term_risk_ok:
        allocation["tactical"] = min(allocation["tactical"], 4)
        allocation["crypto"] = min(allocation["crypto"], 1)
    allocation["crypto"] = min(allocation["crypto"], 5)
    allocation["tactical"] = min(allocation["tactical"], 12)

    # ---- 8. Normalize and clip --------------------------------------------
    for key in list(allocation.keys()):
        allocation[key] = max(0, allocation[key])
    # We don't strictly require sum == 100 because the user's surplus is
    # split across buckets — what matters is each bucket's share.
    return min(100, allocation.get(asset_key, 0))


# ---------------------------------------------------------------------------
# Risk level
# ---------------------------------------------------------------------------


def risk_level(asset: ResearchAsset, context: ProfileContext) -> str:
    if asset.asset_key in {"crypto", "tactical"}:
        return "High"
    if asset.asset_key == "equity":
        # Age alone should not brand equity "High" for someone who has told us
        # they are comfortable riding out drawdowns; 45-59 with genuine
        # long-term risk appetite reads Medium like younger investors.
        if context.panic_risk or context.age_band == "senior":
            return "High"
        if context.age_band == "pre_retire" and not context.long_term_growth_ok:
            return "High"
        return "Medium"
    if asset.asset_key == "gold":
        return "Medium"
    return "Low"


# ---------------------------------------------------------------------------
# Suitability score (0-100)
# ---------------------------------------------------------------------------


def suitability_score(asset: ResearchAsset, context: ProfileContext, supporting: list[dict], conflicting: list[dict]) -> int:
    score = 48

    # Data freshness
    if asset.data_mode == "live":
        score += 12
    elif asset.data_mode in {"cached", "delayed"}:
        score += 6
    score += min(asset.confidence_score, 95) // 8
    score += min(len(supporting) * 4, 16)
    score -= min(len(conflicting) * 5, 18)

    # Bucket-specific personalization
    if asset.asset_key == "debt":
        score += 18 if context.emergency_gap > 0 else 8
        if context.age_band in {"pre_retire", "senior"}:
            score += 6
        if context.has_short_term_goals:
            score += 4

    elif asset.asset_key == "equity":
        if context.long_term_growth_ok:
            score += 16
        if context.age_band == "young":
            score += 6
        elif context.age_band == "senior":
            score -= 6
        if context.panic_risk:
            score -= 8
        if context.portfolio_equity_share > 0.65:
            score -= 10  # already overweight
        if context.has_long_term_goals:
            score += 4
        if context.disciplined:
            score += 3

    elif asset.asset_key == "gold":
        score += 8
        if context.portfolio_gold_share > 0.12:
            score -= 14
        if context.age_band in {"pre_retire", "senior"}:
            score += 3

    elif asset.asset_key == "crypto":
        score += 10 if context.short_term_risk_ok else -8
        if context.portfolio_crypto_share > 0.05:
            score -= 14
        if context.income_tier == "low":
            score -= 12
        if context.panic_risk:
            score -= 10
        if context.emergency_gap > 0:
            score -= 8
        if context.age_band in {"pre_retire", "senior"}:
            score -= 10

    elif asset.asset_key == "tactical":
        score += 6 if context.short_term_risk_ok else -10
        if not context.disciplined:
            score -= 6
        if context.income_tier == "low":
            score -= 8

    # Universal modifiers
    if context.savings_rate < 10:
        score -= 10
    if context.disciplined:
        score += 5
    if context.irregular_income and asset.asset_key in {"tactical", "crypto", "equity"}:
        score -= 4
    if context.invest_monthly_active and asset.asset_key in {"equity", "debt"}:
        score += 3

    return max(5, min(96, round(score)))


# ---------------------------------------------------------------------------
# Confidence score (used alongside conviction)
# ---------------------------------------------------------------------------


def confidence_score(asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> int:
    score = asset.confidence_score
    if supporting:
        score += round(sum(signal["confidenceScore"] for signal in supporting) / len(supporting) * 0.12)
    score -= len(conflicting) * 4
    if asset.data_mode != "live":
        score -= 8
    return max(10, min(94, score))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _income_tier(monthly: int) -> str:
    if monthly <= 50_000:
        return "low"
    if monthly <= 200_000:
        return "mid"
    if monthly <= 500_000:
        return "high"
    return "ultra"


def _age_band(age: int) -> str:
    if age < 30:
        return "young"
    if age < 45:
        return "mid"
    if age < 60:
        return "pre_retire"
    return "senior"


def _goal_horizon_shares(goals: Iterable[ProfileGoal]) -> tuple[float, float, bool, bool]:
    from datetime import datetime

    short_count = 0
    long_count = 0
    total = 0
    today = datetime.now()
    for goal in goals:
        if not goal:
            continue
        total += 1
        target_date = (goal.targetDate or "").strip()
        years_left: float | None = None
        if target_date:
            try:
                d = datetime.strptime(target_date, "%Y-%m-%d")
                years_left = max((d - today).days / 365.25, 0)
            except ValueError:
                years_left = None
        # Goal type-based defaults
        if years_left is None:
            type_str = (goal.type or "").lower()
            if any(k in type_str for k in {"emergency", "travel", "wedding", "marriage", "debt"}):
                years_left = 2
            elif any(k in type_str for k in {"retirement", "freedom", "wealth"}):
                years_left = 15
            elif any(k in type_str for k in {"house", "child", "education"}):
                years_left = 8
            else:
                years_left = 5
        if years_left <= 3:
            short_count += 1
        elif years_left >= 6:
            long_count += 1
    if total == 0:
        return 0.0, 0.0, False, False
    return (short_count / total, long_count / total, short_count > 0, long_count > 0)
