from __future__ import annotations

from dataclasses import dataclass

from app.schemas.financial import OnboardingProfile
from app.services.intelligence import calculate_age, monthly_income, net_worth
from app.services.recommendations.asset_screening_service import ResearchAsset


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


def build_profile_context(profile: OnboardingProfile) -> ProfileContext:
    income = monthly_income(profile)
    surplus = max(income - profile.monthlyExpenses - profile.emi, 0)
    emergency_target = max(profile.emergencyFundTarget or 0, (profile.monthlyExpenses + profile.emi) * 6)
    emergency_gap = max(emergency_target - profile.cashBalance, 0)
    savings_rate = (surplus / income * 100) if income else 0
    additional_equity = sum(item.value for item in profile.additionalInvestments if item.type.lower() in {"etf", "international stocks", "esops", "rsus", "stocks"})
    equity_value = profile.stocksValue + profile.mutualFundsValue + additional_equity
    debt_like_value = profile.epfPpfValue + sum(item.value for item in profile.additionalInvestments if item.type.lower() in {"bonds", "fixed deposits", "recurring deposits", "nps"})
    age = calculate_age(profile.dateOfBirth, profile.age)
    long_term_growth_ok = profile.volatilityComfort == "High" or profile.investmentHorizon in {"7-10 years", "10+ years"} or age < 40
    short_term_risk_ok = profile.shortTermVolatilityComfort == "High" and profile.shortTermLossTolerance in {"10-15%", "15%+"}
    panic_risk = profile.riskReaction == "Panic sell" or profile.panicSellRisk == "Yes"
    disciplined = profile.investsMonthly in {"Yes", "Always"} and profile.spendingDiscipline in {"Strong", "Good"}
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
    )


def target_allocation(asset_key: str, context: ProfileContext) -> int:
    if context.surplus <= 0:
        return 0
    if context.emergency_gap > 0:
        return {"debt": 55, "equity": 30, "gold": 10, "crypto": 0}.get(asset_key, 0)
    if context.long_term_growth_ok and not context.panic_risk:
        return {"equity": 60, "debt": 20, "gold": 10, "crypto": 5 if context.short_term_risk_ok else 0}.get(asset_key, 0)
    return {"equity": 40, "debt": 40, "gold": 10, "crypto": 0}.get(asset_key, 0)


def risk_level(asset: ResearchAsset, context: ProfileContext) -> str:
    if asset.asset_key == "crypto":
        return "High"
    if asset.asset_key == "equity":
        return "Medium" if not context.panic_risk else "High"
    if asset.asset_key == "gold":
        return "Medium"
    return "Low"


def suitability_score(asset: ResearchAsset, context: ProfileContext, supporting: list[dict], conflicting: list[dict]) -> int:
    score = 48
    if asset.data_mode == "live":
        score += 12
    elif asset.data_mode in {"cached", "delayed"}:
        score += 6
    score += min(asset.confidence_score, 95) // 8
    score += min(len(supporting) * 4, 16)
    score -= min(len(conflicting) * 5, 18)
    if asset.asset_key == "debt":
        score += 18 if context.emergency_gap > 0 else 8
    elif asset.asset_key == "equity":
        score += 16 if context.long_term_growth_ok else 4
        if context.panic_risk:
            score -= 8
    elif asset.asset_key == "gold":
        score += 8
        if context.gold_value > context.net_worth * 0.15:
            score -= 12
    elif asset.asset_key == "crypto":
        score += 10 if context.short_term_risk_ok else -20
        if context.crypto_value > context.net_worth * 0.05 and context.net_worth > 0:
            score -= 12
    if context.savings_rate < 10:
        score -= 10
    if context.disciplined:
        score += 5
    return max(5, min(96, round(score)))


def confidence_score(asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> int:
    score = asset.confidence_score
    if supporting:
        score += round(sum(signal["confidenceScore"] for signal in supporting) / len(supporting) * 0.12)
    score -= len(conflicting) * 4
    if asset.data_mode != "live":
        score -= 8
    return max(10, min(94, score))
