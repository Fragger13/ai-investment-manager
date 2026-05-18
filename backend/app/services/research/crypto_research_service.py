from __future__ import annotations

import json

from app.core.config import settings
from app.services.intelligence import now_iso
from app.services.research.http_client import fetch_text


COINGECKO_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=inr,usd&include_24hr_change=true&include_market_cap=true"


def _get_json(url: str, timeout: int = 8) -> tuple[dict | None, str]:
    headers = {}
    if settings.coingecko_api_key:
        headers["x-cg-demo-api-key"] = settings.coingecko_api_key
    result = fetch_text(url, timeout=timeout, retries=2, cache_ttl_seconds=15 * 60, headers=headers, require_json=True)
    try:
        return json.loads(result.text), result.mode
    except (ValueError, json.JSONDecodeError):
        return None, result.mode


def crypto_connector_status() -> dict:
    return {
        "dataMode": "live" if settings.coingecko_api_key else "limited",
        "message": "CoinGecko simple price endpoint is used for BTC/ETH. Free unauthenticated mode may be rate-limited." if not settings.coingecko_api_key else "CoinGecko key configured.",
        "retrievedAt": now_iso(),
    }


def fetch_crypto_research() -> tuple[list[dict], list[dict], str, str]:
    payload, mode = _get_json(COINGECKO_PRICE_URL)
    if not payload:
        return fallback_crypto_research(), [], "fallback", "CoinGecko fetch failed; crypto fallback remains labelled."
    timestamp = now_iso()
    assets = []
    signals = []
    for coin_id, display in [("bitcoin", "Bitcoin"), ("ethereum", "Ethereum")]:
        data = payload.get(coin_id, {})
        price = data.get("inr")
        change = data.get("inr_24h_change")
        market_cap = data.get("inr_market_cap")
        if price is None:
            continue
        change_value = float(change or 0)
        sentiment = "bullish" if change_value > 2 else "bearish" if change_value < -2 else "neutral"
        risk = "High-risk satellite asset. Avoid for essential goals and keep allocation small."
        assets.append(
            {
                "instrumentName": display,
                "assetType": "Crypto asset",
                "category": "High-risk satellite",
                "summary": f"CoinGecko price for {display}: INR {round(price):,}. 24h change: {round(change_value, 2)}%.",
                "suitabilityNotes": "Only suitable for users with high risk comfort after emergency fund and core investments are funded.",
                "riskNotes": risk,
                "evidence": [{"sourceName": "CoinGecko", "sourceUrl": COINGECKO_PRICE_URL, "dataMode": mode, "marketCapInr": market_cap}],
                "dataMode": mode,
                "confidenceScore": 64 if mode == "live" else 45,
                "retrievedAt": timestamp,
            }
        )
        signals.append(
            {
                "title": f"{display} 24h crypto signal",
                "summary": f"{display} moved {round(change_value, 2)}% over 24h according to CoinGecko simple price data.",
                "signalType": "crypto signal",
                "sentiment": sentiment,
                "assetClasses": ["crypto"],
                "instruments": [display],
                "sectors": ["crypto"],
                "macroThemes": ["risk appetite"],
                "riskSignals": ["crypto volatility", "regulatory risk"],
                "opportunitySignals": ["satellite exposure only if risk comfort is high"],
                "relevanceScore": 50,
                "credibilityScore": 82,
                "confidenceScore": 60,
                "sourceName": "CoinGecko",
                "sourceUrl": COINGECKO_PRICE_URL,
                "publishedAt": "",
                "retrievedAt": timestamp,
                "dataMode": mode,
            }
        )
    return assets or fallback_crypto_research(), signals, mode, f"Fetched CoinGecko data for {len(assets)} crypto assets."


def fallback_crypto_research() -> list[dict]:
    timestamp = now_iso()
    return [
        {
            "instrumentName": "Bitcoin",
            "assetType": "Crypto asset",
            "category": "High-risk satellite",
            "summary": "Fallback crypto candidate because CoinGecko data was unavailable.",
            "suitabilityNotes": "Only considered for users with high short-term and long-term risk tolerance.",
            "riskNotes": "Crypto can fall sharply, has regulatory uncertainty, and is unsuitable for essential goals.",
            "evidence": [{"sourceName": "CoinGecko", "sourceUrl": "https://www.coingecko.com/", "dataMode": "fallback"}],
            "dataMode": "fallback",
            "confidenceScore": 35,
            "retrievedAt": timestamp,
        }
    ]
