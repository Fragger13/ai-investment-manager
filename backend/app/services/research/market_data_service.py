from __future__ import annotations

import json
from urllib.parse import quote

from app.core.config import settings
from app.services.intelligence import now_iso
from app.services.research.http_client import fetch_text


YAHOO_SYMBOLS = {
    "Nifty 50": "^NSEI",
    "Nifty Bank": "^NSEBANK",
    "Nifty IT": "^CNXIT",
    "Nifty Next 50": "^NSMIDCP",
    "Nippon India ETF Nifty 50 BeES": "NIFTYBEES.NS",
    "Gold ETF proxy": "GOLDBEES.NS",
}


def _get_json(url: str, timeout: int = 8, headers: dict | None = None) -> tuple[dict | None, str]:
    result = fetch_text(url, timeout=timeout, retries=2, cache_ttl_seconds=6 * 3600, headers=headers, require_json=True)
    try:
        return json.loads(result.text), result.mode
    except (ValueError, json.JSONDecodeError):
        return None, result.mode


def fetch_yahoo_chart(symbol: str) -> dict:
    encoded = quote(symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range=1mo&interval=1d"
    payload, mode = _get_json(url)
    timestamp = now_iso()
    if not payload:
        return {"symbol": symbol, "dataMode": mode, "retrievedAt": timestamp, "error": "Yahoo Finance chart fetch failed."}
    result = (payload.get("chart", {}).get("result") or [{}])[0]
    meta = result.get("meta", {})
    quote_data = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes = [value for value in quote_data.get("close", []) if isinstance(value, (int, float))]
    change_pct = 0.0
    if len(closes) >= 2 and closes[0]:
        change_pct = ((closes[-1] - closes[0]) / closes[0]) * 100
    return {
        "symbol": symbol,
        "regularMarketPrice": meta.get("regularMarketPrice"),
        "currency": meta.get("currency", "INR"),
        "oneMonthChangePct": round(change_pct, 2),
        "dataMode": mode,
        "sourceName": "Yahoo Finance chart API",
        "sourceUrl": url,
        "retrievedAt": timestamp,
    }


def fetch_structured_market_data() -> list[dict]:
    return [fetch_yahoo_chart(symbol) | {"name": name} for name, symbol in YAHOO_SYMBOLS.items()]


def market_data_status() -> dict:
    live_keys = [key for key, value in {
        "ALPHA_VANTAGE_API_KEY": settings.alpha_vantage_api_key,
        "TWELVE_DATA_API_KEY": settings.twelve_data_api_key,
    }.items() if value]
    message = "Yahoo Finance chart endpoints are used directly because yfinance is optional in this environment."
    if live_keys:
        message += f" Additional keys configured: {', '.join(live_keys)}."
    return {"dataMode": "live", "message": message, "retrievedAt": now_iso()}


def market_data_to_signals(items: list[dict]) -> list[dict]:
    signals = []
    for item in items:
        if item.get("error"):
            continue
        change = float(item.get("oneMonthChangePct") or 0)
        if change >= 3:
            signal_type = "market trend"
            sentiment = "bullish"
            summary = f"{item['name']} is up {change}% over roughly one month based on Yahoo Finance chart data."
            opportunity = ["positive price trend"]
            risks = ["momentum can reverse quickly"]
        elif change <= -3:
            signal_type = "risk warning"
            sentiment = "bearish"
            summary = f"{item['name']} is down {abs(change)}% over roughly one month based on Yahoo Finance chart data."
            opportunity = ["possible staggered entry for long-term investors"]
            risks = ["near-term market weakness"]
        else:
            signal_type = "market trend"
            sentiment = "neutral"
            summary = f"{item['name']} is broadly range-bound over roughly one month based on Yahoo Finance chart data."
            opportunity = ["use SIP discipline rather than timing"]
            risks = ["sideways markets can test patience"]
        signals.append(
            {
                "title": item["name"],
                "summary": summary,
                "signalType": signal_type,
                "sentiment": sentiment,
                "assetClasses": ["equity", "ETF"] if "Nifty" in item["name"] or "ETF" in item["name"] else ["gold"],
                "instruments": [item["name"]],
                "sectors": ["broad market"] if "Nifty" in item["name"] else [],
                "macroThemes": ["volatility"],
                "riskSignals": risks,
                "opportunitySignals": opportunity,
                "relevanceScore": 78,
                "credibilityScore": 80,
                "confidenceScore": 76,
                "sourceName": item.get("sourceName", "Yahoo Finance chart API"),
                "sourceUrl": item.get("sourceUrl", "https://finance.yahoo.com/"),
                "publishedAt": "",
                "retrievedAt": item["retrievedAt"],
                "dataMode": item["dataMode"],
            }
        )
    return signals


def structured_market_fallback() -> list[dict]:
    timestamp = now_iso()
    return [
        {
            "title": "Equity SIPs prefer staggered entry",
            "summary": "Fallback structured signal: for long horizons, staggered SIP entry is preferred over lump sum when volatility is uncertain.",
            "signalType": "risk warning",
            "sentiment": "neutral",
            "assetClasses": ["equity", "mutual fund", "ETF"],
            "instruments": ["UTI Nifty 50 Index Fund", "HDFC Index Fund Nifty 50 Plan", "Nippon India ETF Nifty 50 BeES"],
            "sectors": ["broad market"],
            "macroThemes": ["volatility"],
            "riskSignals": ["near-term market volatility can affect lump-sum entries"],
            "opportunitySignals": ["long-term diversified equity exposure"],
            "relevanceScore": 78,
            "credibilityScore": 70,
            "confidenceScore": 72,
            "sourceName": "Internal fallback market-data layer",
            "sourceUrl": "internal://fallback/market-data",
            "publishedAt": "",
            "retrievedAt": timestamp,
            "dataMode": "fallback",
        },
        {
            "title": "Emergency money should stay low-volatility",
            "summary": "Fallback structured signal: short-term money should prioritize access and stability over return chasing.",
            "signalType": "risk warning",
            "sentiment": "neutral",
            "assetClasses": ["debt", "cash"],
            "instruments": ["SBI Liquid Fund", "ICICI Prudential Liquid Fund"],
            "sectors": ["debt funds"],
            "macroThemes": ["interest rates"],
            "riskSignals": ["credit and interest-rate risk still need checking"],
            "opportunitySignals": ["liquidity and lower volatility"],
            "relevanceScore": 84,
            "credibilityScore": 72,
            "confidenceScore": 78,
            "sourceName": "Internal fallback market-data layer",
            "sourceUrl": "internal://fallback/liquidity",
            "publishedAt": "",
            "retrievedAt": timestamp,
            "dataMode": "fallback",
        },
    ]
