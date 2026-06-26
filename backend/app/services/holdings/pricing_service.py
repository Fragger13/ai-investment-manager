"""Live pricing fan-out for user holdings.

Sources:
- Stocks / ETFs (NSE/BSE): Yahoo Finance v8 chart endpoint (no key)
- Mutual funds: AMFI daily NAV text (cached 24h via fund_research_service)
- Crypto: CoinGecko free API (/simple/price)
- Gold / silver (physical): metals.live spot (best-effort)

Each holding's currentValue is recomputed when a price is found. If no price
is found (unknown ticker, no symbol, API failure), the holding is returned
with source='manual' and currentValue unchanged.
"""

from __future__ import annotations

import json
import time
from typing import Iterable
from urllib.parse import quote

from app.schemas.financial import Holding
from app.services.intelligence import now_iso
from app.services.research.fund_research_service import fetch_amfi_nav_text
from app.services.research.http_client import fetch_text

# Common crypto symbol → CoinGecko ID lookup. Add more as needed.
CRYPTO_ID_MAP = {
    "btc": "bitcoin",
    "bitcoin": "bitcoin",
    "eth": "ethereum",
    "ethereum": "ethereum",
    "sol": "solana",
    "solana": "solana",
    "usdt": "tether",
    "usdc": "usd-coin",
    "bnb": "binancecoin",
    "xrp": "ripple",
    "ada": "cardano",
    "doge": "dogecoin",
    "matic": "matic-network",
    "polygon": "matic-network",
    "trx": "tron",
    "dot": "polkadot",
    "ltc": "litecoin",
    "shib": "shiba-inu",
    "avax": "avalanche-2",
    "link": "chainlink",
    "atom": "cosmos",
}

_AMFI_CACHE: dict[str, tuple[float, dict[str, float]]] = {}
_AMFI_TTL = 24 * 3600


def _amfi_nav_map() -> dict[str, float]:
    cached = _AMFI_CACHE.get("map")
    now = time.time()
    if cached and now - cached[0] < _AMFI_TTL:
        return cached[1]
    text, _, _ = fetch_amfi_nav_text()
    nav_map: dict[str, float] = {}
    if text:
        for line in text.splitlines():
            parts = line.split(";")
            if len(parts) >= 5:
                code = parts[0].strip()
                if not code or not code[0].isdigit():
                    continue
                try:
                    nav = float(parts[4].strip())
                except ValueError:
                    continue
                if nav > 0:
                    nav_map[code] = nav
    _AMFI_CACHE["map"] = (now, nav_map)
    return nav_map


def _price_stock(symbol: str) -> float | None:
    if not symbol:
        return None
    # Try .NS first (NSE), then .BO (BSE), then bare
    for suffix in (".NS", ".BO", ""):
        ticker = symbol if symbol.endswith((".NS", ".BO")) else f"{symbol}{suffix}"
        encoded = quote(ticker, safe="")
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range=5d&interval=1d"
        result = fetch_text(url, timeout=8, retries=1, cache_ttl_seconds=900, require_json=True)
        if not result.text:
            continue
        try:
            payload = json.loads(result.text)
        except (ValueError, json.JSONDecodeError):
            continue
        chart_result = (payload.get("chart", {}).get("result") or [{}])[0]
        meta = chart_result.get("meta") or {}
        price = meta.get("regularMarketPrice")
        if isinstance(price, (int, float)) and price > 0:
            return float(price)
    return None


def _price_crypto(symbol: str) -> float | None:
    if not symbol:
        return None
    coin_id = CRYPTO_ID_MAP.get(symbol.lower())
    if not coin_id:
        return None
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=inr"
    result = fetch_text(url, timeout=8, retries=1, cache_ttl_seconds=600, require_json=True)
    if not result.text:
        return None
    try:
        payload = json.loads(result.text)
    except (ValueError, json.JSONDecodeError):
        return None
    inr = (payload.get(coin_id) or {}).get("inr")
    return float(inr) if isinstance(inr, (int, float)) and inr > 0 else None


# gold-api.com returns the spot price in USD per troy ounce (1 oz = 31.1035 g).
_METAL_SYMBOLS = {"gold": "XAU", "silver": "XAG"}
_USD_INR = 86.0  # rough USD→INR; metals are quoted in USD upstream


def _price_metal(metal: str) -> float | None:
    """Spot price in INR/gram for gold/silver via gold-api.com (no key)."""
    symbol = _METAL_SYMBOLS.get(metal.lower())
    if not symbol:
        return None
    url = f"https://api.gold-api.com/price/{symbol}"
    result = fetch_text(url, timeout=8, retries=1, cache_ttl_seconds=3600, require_json=True)
    if not result.text:
        return None
    try:
        payload = json.loads(result.text)
    except (ValueError, json.JSONDecodeError):
        return None
    price = payload.get("price") if isinstance(payload, dict) else None
    if isinstance(price, (int, float)) and price > 0:
        usd_per_oz = float(price)
        return (usd_per_oz / 31.1035) * _USD_INR
    return None


def quote_unit_price(symbol: str, asset_class: str) -> float | None:
    """Best-effort live price for ONE unit of an instrument, used when recording
    an action (the default purchase price). Dispatches to the same sources as
    refresh_prices. Returns None when the instrument can't be priced (e.g. a
    fund identified only by name, or an unknown ticker)."""
    ac = (asset_class or "").lower()
    sym = (symbol or "").strip()
    if not sym and ac not in ("gold", "silver"):
        return None
    if ac in ("stock", "etf", "equity", "share"):
        return _price_stock(sym)
    if ac in ("mutualfund", "mutual_fund", "fund", "mf", "index"):
        # AMFI NAV is keyed by numeric scheme code; only resolves when the
        # symbol is that code (otherwise the caller falls back to a passed price).
        return _amfi_nav_map().get(sym)
    if ac == "crypto":
        return _price_crypto(sym)
    if ac in ("gold", "silver"):
        return _price_metal(ac)
    # Unknown class: try a stock ticker, then crypto.
    return _price_stock(sym) or _price_crypto(sym)


def refresh_prices(holdings: Iterable[Holding]) -> list[Holding]:
    """Return a new list with currentValue + lastPricedAt updated where possible."""
    nav_map: dict[str, float] | None = None
    gold_per_gram: float | None = None
    silver_per_gram: float | None = None
    timestamp = now_iso()
    updated: list[Holding] = []

    for h in holdings:
        new_value = h.currentValue
        new_source = h.source
        priced = False

        if h.assetClass in ("stock", "etf") and h.symbol and h.units:
            price = _price_stock(h.symbol)
            if price:
                new_value = price * h.units
                priced = True
        elif h.assetClass == "mutualFund" and h.schemeCode and h.units:
            if nav_map is None:
                nav_map = _amfi_nav_map()
            nav = nav_map.get(h.schemeCode.strip())
            if nav:
                new_value = nav * h.units
                priced = True
        elif h.assetClass == "crypto" and h.symbol and h.units:
            price = _price_crypto(h.symbol)
            if price:
                new_value = price * h.units
                priced = True
        elif h.assetClass == "gold" and h.units:
            if gold_per_gram is None:
                gold_per_gram = _price_metal("gold") or 0.0
            if gold_per_gram:
                new_value = gold_per_gram * h.units
                priced = True
        elif h.assetClass == "silver" and h.units:
            if silver_per_gram is None:
                silver_per_gram = _price_metal("silver") or 0.0
            if silver_per_gram:
                new_value = silver_per_gram * h.units
                priced = True

        updated.append(Holding(
            id=h.id,
            assetClass=h.assetClass,
            name=h.name,
            symbol=h.symbol,
            schemeCode=h.schemeCode,
            units=h.units,
            currentValue=round(new_value, 2),
            valueAtCost=h.valueAtCost,
            hasSip=h.hasSip,
            sipAmount=h.sipAmount,
            source="live" if priced else new_source,
            lastPricedAt=timestamp if priced else h.lastPricedAt,
        ))

    return updated
