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
    """Equity stock candidates from the LIVE NSE universe, ranked on real factors
    (no hardcoded tickers). Crypto remains a small fixed set until Pass 3."""
    timestamp = now_iso()
    candidates: list[ResearchAsset] = []

    try:
        from app.services.research.equity_factor_service import top_equity_candidates

        for cand in top_equity_candidates(limit=12, exclude=list(existing_names)):
            f = cand["factors"]
            symbol = cand["ticker"].replace(".NS", "")
            metric_bits = []
            if f.get("sortino") is not None:
                metric_bits.append(f"Sortino {f['sortino']}")
            if f.get("maxDrawdown3y") is not None:
                metric_bits.append(f"worst 3y drawdown {f['maxDrawdown3y']}%")
            if f.get("alpha") is not None:
                metric_bits.append(f"alpha {f['alpha']}% vs Nifty 50")
            metrics = ", ".join(metric_bits) or "risk-adjusted metrics computed from price history"
            summary = (
                f"{cand['name']} surfaced from the live NSE universe and ranks well on risk-adjusted "
                f"factors ({metrics}). Use only as a diversified stock sleeve, not a replacement for "
                f"core funds or emergency money."
            )
            candidates.append(
                _candidate(
                    cand["name"],
                    "Equity share",
                    cand.get("industry") or "Large-cap stock",
                    summary,
                    "Suitable for a small satellite stock allocation for users who accept single-stock risk and already hold core funds.",
                    "Single stocks can underperform the market, face company-specific shocks, and need periodic review.",
                    f"https://www.nseindia.com/get-quotes/equity?symbol={symbol}",
                    timestamp,
                )
            )
    except Exception:  # noqa: BLE001 — equity data must never break screening
        candidates = []

    # Crypto satellites from the LIVE CoinGecko top-market-cap universe (no
    # hardcoded coins), ranked on real risk-adjusted factors.
    try:
        from app.services.research.crypto_factor_service import top_crypto_candidates

        for cand in top_crypto_candidates(limit=2, exclude=list(existing_names)):
            f = cand["factors"]
            bits = []
            if f.get("sortino") is not None:
                bits.append(f"Sortino {f['sortino']}")
            if f.get("maxDrawdown3y") is not None:
                bits.append(f"worst drawdown {f['maxDrawdown3y']}%")
            metrics = ", ".join(bits) or "risk-adjusted metrics from price history"
            candidates.append(
                _candidate(
                    cand["name"],
                    "Crypto asset",
                    "Crypto satellite",
                    f"{cand['name']} surfaced from the live top-market-cap crypto universe and ranks well on "
                    f"risk-adjusted factors ({metrics}). For a very small satellite allocation only after "
                    "emergency fund, debt, and core investments are handled.",
                    "Suitable only for users who can tolerate large temporary or permanent losses.",
                    "Crypto can fall sharply; regulation, liquidity, and market-cycle risks are high.",
                    f"https://www.coingecko.com/en/coins/{cand['coinId']}",
                    timestamp,
                )
            )
    except Exception:  # noqa: BLE001 — crypto data must never break screening
        pass

    # Fixed Deposit — a guaranteed-return fixed-income option (no market data).
    # Surfaces for safety / near-term goals via the normal suitability flow.
    candidates.append(
        _candidate(
            "Bank Fixed Deposit",
            "Fixed deposit",
            "Guaranteed fixed-income (debt)",
            "Bank FD is a capital-guaranteed option returning roughly 6.5-7.5% p.a. (varies by bank/tenure). "
            "Best for money you cannot afford to lose or need on a fixed date; returns are taxable at slab rate.",
            "Suitable for emergency money, very conservative investors, and near-term goals where capital safety beats higher returns.",
            "Returns are locked at booking and may trail inflation/debt funds; premature withdrawal carries a penalty.",
            "https://www.rbi.org.in/",
            timestamp,
        )
    )
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
