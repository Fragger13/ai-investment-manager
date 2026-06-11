from __future__ import annotations

from app.services.recommendations.asset_screening_service import ResearchAsset


def build_timing_plan(asset: ResearchAsset, regime: dict, supporting: list[dict], conflicting: list[dict]) -> dict:
    if asset.asset_key == "debt":
        return {
            "entryApproach": "Use immediate monthly transfers for emergency or near-term money after checking exit load and credit quality.",
            "buyRange": "Add money regularly each month. Do not wait for a perfect market day.",
            "sellRange": "Withdraw only when the linked goal is funded or this investment becomes less suitable.",
            "reviewCadence": "Review monthly until your emergency or near-term savings gap is closed.",
        }
    if asset.asset_key == "equity":
        entry = "Invest monthly or split a larger amount into 3-6 smaller parts."
        if regime.get("regime") == "risk-off" or conflicting:
            entry = "Invest smaller amounts monthly or split a larger amount into 6-12 parts while markets remain uncertain."
        return {
            "entryApproach": entry,
            "buyRange": "Add money on planned dates instead of reacting to daily market moves.",
            "sellRange": "Reduce this when the linked goal is within 3-5 years or shares exceed the suggested mix by 10 percentage points.",
            "reviewCadence": regime.get("reviewCadence", "Review every 60-90 days."),
        }
    if asset.asset_key == "gold":
        return {
            "entryApproach": "Build gradually as a source of stability, especially when markets feel uncertain.",
            "buyRange": "Accumulate in small monthly lots; avoid chasing sharp spikes.",
            "sellRange": "Reduce gold if it exceeds 10-12% of your investments or you need access to the money.",
            "reviewCadence": "Review every 6 months.",
        }
    if asset.asset_key == "tactical":
        return {
            "entryApproach": "Use only a small amount after your regular investments are funded. Do not rely on this to fund an important goal.",
            "buyRange": "Add money only on planned review dates or after the sector trend improves. Avoid chasing a one-day jump.",
            "sellRange": "Reduce this if the sector rises sharply, markets become more cautious, or the reason for owning it weakens.",
            "reviewCadence": "Review every 2-4 weeks.",
        }
    return {
        "entryApproach": "Use only a small optional amount after your main goals are funded.",
        "buyRange": "Add only small fixed amounts. Review the idea before adding more after a sharp fall.",
        "sellRange": "Reduce this after a very large gain, a rule change, or if it grows beyond 5%.",
        "reviewCadence": "Review weekly or after major regulatory/news events.",
    }
