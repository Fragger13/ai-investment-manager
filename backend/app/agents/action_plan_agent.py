from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.recommendations.asset_screening_service import ResearchAsset
from app.services.recommendations.suitability_scoring_service import ProfileContext


def review_date(asset_key: str) -> str:
    days = {"debt": 60, "equity": 90, "gold": 180, "crypto": 30}.get(asset_key, 90)
    return (datetime.now(UTC).date() + timedelta(days=days)).isoformat()


def build_action_plan(asset: ResearchAsset, context: ProfileContext, fit: dict) -> dict:
    amount = fit["suggestedMonthlyAmount"]
    if asset.asset_key == "debt":
        return {
            "entryApproach": "Use monthly transfers until your emergency fund target is reached. Do not use this money for long-term market risk.",
            "actionPlan": [
                f"Consider setting aside about ₹{amount:,}/month for emergency or near-term money.",
                "Keep this separate from equity investments.",
                "Review credit quality, expense ratio, and exit rules before investing.",
            ],
            "exitOrRebalanceCondition": "Stop adding fresh money here once emergency savings cover about 6 months of expenses, then redirect surplus to long-term goals.",
            "timeHorizon": "0-3 years",
            "goalTag": "Emergency fund",
        }
    if asset.asset_key == "equity":
        return {
            "entryApproach": "Use a SIP instead of one large lump sum, especially when market signals show volatility.",
            "actionPlan": [
                f"Consider starting a SIP of about ₹{amount:,}/month.",
                "Use this only for goals at least 5-7 years away.",
                "Increase the SIP only after emergency fund and high-interest debt are under control.",
            ],
            "exitOrRebalanceCondition": "Reduce or rebalance if your goal is less than 5 years away, your equity allocation becomes too high, or you feel forced to sell during falls.",
            "timeHorizon": "7+ years",
            "goalTag": "Long-term wealth",
        }
    if asset.asset_key == "gold":
        return {
            "entryApproach": "Add gradually and keep gold as a small diversification layer, not the main growth engine.",
            "actionPlan": [
                f"Consider limiting fresh gold allocation to about ₹{amount:,}/month.",
                "Keep total gold near 5-10% of your portfolio.",
                "Choose SGB only if the lock-in and liquidity fit your timeline; otherwise use a low-cost ETF.",
            ],
            "exitOrRebalanceCondition": "Trim if gold grows above 10-12% of the portfolio or if you need liquidity sooner than the instrument allows.",
            "timeHorizon": "3+ years",
            "goalTag": "Diversification",
        }
    return {
        "entryApproach": "Treat this as a small satellite position only after core goals are funded.",
        "actionPlan": [
            f"If suitable, cap the allocation near ₹{amount:,}/month or less.",
            "Avoid using money needed for emergency fund, rent, EMIs, or near-term goals.",
            "Review weekly because this asset can move sharply.",
        ],
        "exitOrRebalanceCondition": "Exit or reduce if allocation exceeds 5%, regulation changes, or volatility makes you likely to panic-sell.",
        "timeHorizon": "High-risk satellite",
        "goalTag": "Optional high-risk exposure",
    }
