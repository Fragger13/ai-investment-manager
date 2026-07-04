from __future__ import annotations


def _is_large_cap(name: str) -> bool:
    """A name is treated as large-cap-liquid if it's a current NSE index
    constituent (live), rather than matching a hardcoded list."""
    try:
        from app.services.research.equity_factor_service import ticker_from_constituents

        return bool(ticker_from_constituents(name))
    except Exception:  # noqa: BLE001
        return False


def assess_liquidity_and_risk(asset: dict, technical: dict, crypto: dict | None = None) -> dict:
    name = asset["name"]
    asset_class = asset.get("assetClass", "stock")
    if asset_class == "crypto":
        liquidity = crypto.get("liquidityScore", 55) if crypto else 55
        volatility = crypto.get("volatilityScore", 90) if crypto else 90
        passed = liquidity >= 55  # crypto candidates already come from the live top-market-cap universe
        risk_category = "extreme" if volatility >= 80 else "high"
        notes = "Crypto is highly volatile; keep it capped and avoid essential-goal money."
    elif "ETF" in asset_class or asset.get("ticker", "").endswith("BEES.NS"):
        liquidity = 72
        volatility = technical.get("volatility", 50)
        passed = True
        risk_category = "medium"
        notes = "ETF liquidity should still be checked on exchange before placing orders."
    elif _is_large_cap(name):
        liquidity = 78
        volatility = technical.get("volatility", 55)
        passed = True
        risk_category = "medium" if volatility < 70 else "high"
        notes = "Large-cap liquidity proxy passed; still check bid-ask spread and latest volume."
    else:
        liquidity = 48
        volatility = technical.get("volatility", 70)
        passed = False
        risk_category = "high"
        notes = "Liquidity data is limited; classify as watchlist unless live volume and market cap are verified."
    if technical.get("drawdown") and technical["drawdown"] < -35:
        risk_category = "high" if risk_category != "extreme" else "extreme"
    return {
        "marketCapTier": "large" if _is_large_cap(name) or asset_class == "crypto" else "mid/limited",
        "volumeScore": liquidity,
        "liquidityScore": liquidity,
        "minimumLiquidityPassed": passed,
        "liquidityNotes": notes,
        "riskCategory": risk_category,
        "volatilityScore": min(100, max(0, int(volatility or 50))),
        "drawdownScore": _drawdown_score(technical.get("drawdown")),
        "concentrationRisk": "Single asset exposure must stay capped; do not replace core diversification.",
        "suitabilityRisk": "High-risk or limited-liquidity assets should remain watchlist unless profile and evidence support action.",
        "riskNotes": notes,
    }


def _drawdown_score(drawdown: float | None) -> int:
    if drawdown is None:
        return 55
    return min(100, max(0, round(abs(drawdown) * 2)))
