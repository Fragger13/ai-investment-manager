from __future__ import annotations

from app.services.recommendations.asset_screening_service import ResearchAsset


def rank_stock_candidate(asset: ResearchAsset, fundamental: dict, technical: dict, sentiment: dict, regime: dict) -> dict:
    quality = fundamental.get("fundamentalScore", fundamental.get("overallFundamentalScore", 50))
    momentum = technical.get("technicalScore", technical.get("momentumScore", 50))
    sentiment_score = sentiment.get("sentimentScore", 50)
    volatility_penalty = 18 if asset.asset_key == "crypto" else 12 if "underdog" in asset.category.lower() else 8
    liquidity_penalty = 8 if asset.data_mode == "limited" else 2
    regime_bonus = 8 if regime.get("regime") == "risk-on" else -8 if regime.get("regime") == "risk-off" else 0
    expected_return_score = max(5, min(95, round(quality * 0.34 + momentum * 0.34 + sentiment_score * 0.18 + 50 * 0.14 + regime_bonus - volatility_penalty - liquidity_penalty)))
    return {
        "assetId": asset.instrument_name,
        "rank": 0,
        "expectedReturnScore": expected_return_score,
        "qualityScore": quality,
        "momentumScore": momentum,
        "valuationScore": fundamental.get("valuationScore", max(25, min(80, quality - 5))),
        "volatilityPenalty": volatility_penalty,
        "liquidityPenalty": liquidity_penalty,
        "modelConfidence": 58 if asset.data_mode == "limited" else 72,
        "modelUsed": "deterministic_rolling_window_proxy_v1",
        "rollingWindowPeriod": "latest available source window; no look-ahead labels used",
    }


def assign_ranks(ranks: list[dict]) -> list[dict]:
    ordered = sorted(ranks, key=lambda item: item["expectedReturnScore"], reverse=True)
    for index, item in enumerate(ordered, start=1):
        item["rank"] = index
    return ordered
