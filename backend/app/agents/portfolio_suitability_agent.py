from __future__ import annotations

from app.schemas.financial import OnboardingProfile
from app.services.recommendations.asset_screening_service import ResearchAsset
from app.services.recommendations.suitability_scoring_service import ProfileContext, build_profile_context, confidence_score, risk_level, suitability_score, target_allocation


def analyze_asset_fit(profile: OnboardingProfile, asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> dict:
    context = build_profile_context(profile)
    return analyze_asset_fit_with_context(context, asset, supporting, conflicting)


def analyze_asset_fit_with_context(context: ProfileContext, asset: ResearchAsset, supporting: list[dict], conflicting: list[dict]) -> dict:
    allocation = target_allocation(asset.asset_key, context)
    amount = round(context.surplus * allocation / 100)
    if asset.asset_key == "crypto":
        amount = min(amount, round(context.surplus * 0.05))
    return {
        "assetKey": asset.asset_key,
        "suggestedAllocationPercentage": allocation,
        "suggestedMonthlyAmount": max(amount, 0),
        "suitabilityScore": suitability_score(asset, context, supporting, conflicting),
        "confidenceScore": confidence_score(asset, supporting, conflicting),
        "riskLevel": risk_level(asset, context),
    }
