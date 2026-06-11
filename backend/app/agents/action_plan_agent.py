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
            "entryApproach": "Use monthly transfers until your emergency savings reach the suggested level. Do not use this money for long-term market risk.",
            "actionPlan": [
                f"Consider setting aside about ₹{amount:,}/month for emergency or near-term money.",
                "Keep this separate from equity investments.",
                "Review the fund quality, fees, and withdrawal rules before investing.",
            ],
            "exitOrRebalanceCondition": "Stop adding fresh money here once emergency savings cover about 6 months of expenses, then redirect surplus to long-term goals.",
            "timeHorizon": "0-3 years",
            "goalTag": "Emergency fund",
        }
    if asset.asset_key == "equity":
        return {
            "entryApproach": "Invest a set amount each month instead of one large amount, especially when markets are moving sharply.",
            "actionPlan": [
                f"Consider starting a SIP of about ₹{amount:,}/month.",
                "Use this only for goals at least 5-7 years away.",
                "Increase the SIP only after emergency fund and high-interest debt are under control.",
            ],
            "exitOrRebalanceCondition": "Reduce or review this if your goal is less than 5 years away, too much money is in shares, or you feel forced to sell during a fall.",
            "timeHorizon": "7+ years",
            "goalTag": "Long-term wealth",
        }
    if asset.asset_key == "gold":
        return {
            "entryApproach": "Add gradually and keep gold as a small source of stability, not your main growth investment.",
            "actionPlan": [
                f"Consider limiting new gold investments to about ₹{amount:,}/month.",
                "Keep total gold near 5-10% of your investments.",
                "Choose SGB only if its lock-in period and access to your money fit your timeline. Otherwise, consider a low-cost ETF.",
            ],
            "exitOrRebalanceCondition": "Reduce gold if it grows above 10-12% of your investments or if you need the money sooner than the investment allows.",
            "timeHorizon": "3+ years",
            "goalTag": "Diversification",
        }
    if asset.asset_key == "tactical":
        return {
            "entryApproach": "Use this only as a small short-term idea after your regular investments and priority goals are funded.",
            "actionPlan": [
                f"Consider limiting this short-term idea to about ₹{amount:,}/month or less.",
                "Set the review date before entering.",
                "Do not use money needed for emergency fund, EMIs, or near-term goals.",
            ],
            "exitOrRebalanceCondition": "Exit or reduce if markets become more cautious, the sector trend weakens, or the loss exceeds your short-term comfort.",
            "timeHorizon": "1-12 months",
            "goalTag": "Short-term opportunity",
        }
    return {
        "entryApproach": "Keep this as a small optional investment only after your main goals are funded.",
        "actionPlan": [
            f"If suitable, limit this to about ₹{amount:,}/month or less.",
            "Avoid using money needed for emergency fund, rent, EMIs, or near-term goals.",
            "Review weekly because this asset can move sharply.",
        ],
        "exitOrRebalanceCondition": "Exit or reduce if it grows beyond 5%, rules change, or sharp price moves make you likely to sell in a rush.",
        "timeHorizon": "Optional higher-risk idea",
        "goalTag": "Optional higher-risk investment",
    }
