from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.recommendations.asset_screening_service import ResearchAsset, screen_assets_for_recommendations
from app.services.intelligence import now_iso


def screen_assets_for_institutional_engine(db: Session, goals: list[dict], regime: dict) -> tuple[list[ResearchAsset], list[dict]]:
    assets, signals = screen_assets_for_recommendations(db)
    if not any("asset intelligence" in asset.category.lower() for asset in assets):
        try:
            from app.services.assets.asset_intelligence_service import refresh_asset_intelligence

            refresh_asset_intelligence(db)
            assets, signals = screen_assets_for_recommendations(db)
        except Exception:
            # Recommendations should remain available even when an external asset-data refresh fails.
            pass
    assets.extend(_institutional_candidate_assets({asset.instrument_name for asset in assets}))
    ranked = sorted(assets, key=lambda asset: _asset_rank(asset, goals, regime), reverse=True)
    return ranked, signals


def _asset_rank(asset: ResearchAsset, goals: list[dict], regime: dict) -> int:
    key = asset.asset_key
    eligible_count = sum(1 for goal in goals if key in goal["eligibleAssetKeys"])
    rank = asset.confidence_score + eligible_count * 12
    rank += {"equity": regime.get("equityBias", 0), "debt": regime.get("debtBias", 0), "gold": regime.get("goldBias", 0), "crypto": regime.get("cryptoBias", 0)}.get(key, 0)
    if key == "crypto" and not any(goal["aspirational"] for goal in goals):
        rank -= 20
    if key == "debt" and any(goal["horizonBucket"] == "near-term" for goal in goals):
        rank += 15
    if key == "tactical" and regime.get("regime") == "risk-off":
        rank -= 8
    if "asset intelligence accumulate" in asset.category.lower():
        rank += 22
    elif "asset intelligence watchlist" in asset.category.lower():
        rank += 10
    if "limited data" in asset.summary.lower() and asset.confidence_score < 55:
        rank -= 12
    return rank


def _institutional_candidate_assets(existing_names: set[str]) -> list[ResearchAsset]:
    timestamp = now_iso()
    candidates = [
        _candidate(
            "HDFC Bank Ltd",
            "Equity share",
            "Large-cap private bank stock",
            "Large private bank stock candidate for direct equity exposure. Use only as a diversified stock allocation, not as a replacement for emergency money.",
            "Suitable only for users who accept stock-specific risk and already have core diversification.",
            "Single stocks can underperform the market, face company-specific shocks, and require periodic review.",
            "https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK",
            timestamp,
        ),
        _candidate(
            "ICICI Bank Ltd",
            "Equity share",
            "Large-cap private bank stock",
            "Large bank stock candidate for a direct equity sleeve where the user wants stock exposure beyond index funds.",
            "Suitable for a small satellite stock allocation inside long-term goals.",
            "Banking stocks are sensitive to credit cycles, rates, regulation, and asset-quality surprises.",
            "https://www.nseindia.com/get-quotes/equity?symbol=ICICIBANK",
            timestamp,
        ),
        _candidate(
            "Reliance Industries Ltd",
            "Equity share",
            "Large-cap diversified stock",
            "Diversified large-cap stock candidate across energy, retail, telecom, and digital businesses.",
            "Suitable only as part of a basket, not as a concentrated bet.",
            "Conglomerate execution, commodity cycles, regulation, and valuation risk can affect returns.",
            "https://www.nseindia.com/get-quotes/equity?symbol=RELIANCE",
            timestamp,
        ),
        _candidate(
            "Infosys Ltd",
            "Equity share",
            "Large-cap IT services stock",
            "IT services stock candidate for global technology services exposure within an equity basket.",
            "Suitable for long-term investors who can tolerate sector cycles.",
            "IT stocks face currency, global demand, margin, and client spending risks.",
            "https://www.nseindia.com/get-quotes/equity?symbol=INFY",
            timestamp,
        ),
        _candidate(
            "Nippon India ETF Bank BeES",
            "Tactical ETF",
            "Banking sector tactical opportunity",
            "Sector ETF candidate for tactical banking exposure when market signals support financial-sector rotation.",
            "Use only as a capped tactical allocation after priority goals and emergency money are protected.",
            "Sector ETFs can be volatile and should not become a core retirement allocation.",
            "https://www.nseindia.com/get-quotes/equity?symbol=BANKBEES",
            timestamp,
            category_key="tactical",
        ),
        _candidate(
            "Bitcoin",
            "Crypto asset",
            "Crypto satellite",
            "Crypto candidate for users with high risk capacity and aspirational goals only.",
            "Suitable only after emergency fund, debt pressure, and core long-term investments are handled.",
            "Crypto can fall sharply, regulation can change, and liquidity can deteriorate in stress periods.",
            "https://www.coingecko.com/en/coins/bitcoin",
            timestamp,
        ),
        _candidate(
            "Ethereum",
            "Crypto asset",
            "Crypto satellite",
            "Crypto candidate for a very small satellite allocation where high volatility is acceptable.",
            "Suitable only for users who can tolerate large temporary or permanent losses.",
            "Smart-contract, regulation, competition, and market-cycle risks are high.",
            "https://www.coingecko.com/en/coins/ethereum",
            timestamp,
        ),
    ]
    return [asset for asset in candidates if asset.instrument_name not in existing_names]


def _candidate(
    name: str,
    asset_type: str,
    category: str,
    summary: str,
    suitability: str,
    risk: str,
    source_url: str,
    timestamp: str,
    category_key: str | None = None,
) -> ResearchAsset:
    return ResearchAsset(
        instrument_name=name,
        asset_type=asset_type,
        category=category_key or category,
        summary=f"{summary} Data mode: limited candidate list; verify live price and latest filings before acting.",
        suitability_notes=suitability,
        risk_notes=risk,
        evidence=[{"sourceName": "Public market reference", "sourceUrl": source_url, "dataMode": "limited"}],
        data_mode="limited",
        confidence_score=62,
        retrieved_at=timestamp,
    )
