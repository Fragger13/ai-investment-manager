"""Quantitative factor engine for crypto.

The crypto counterpart of ``equity_factor_service``: the universe is the live
top-market-cap coins from CoinGecko (no hardcoded coins), and factors are
computed from real CoinGecko price history via the shared
``fund_factor_service.compute_factors``. Stablecoins and wrapped tokens are
excluded (not investments). CoinGecko's free tier caps history at ~1 year, so a
lower ``min_months`` is used — vol/drawdown/Sortino/momentum are meaningful;
multi-year metrics simply stay None.

Cached 24h and degrades safely so a network failure never breaks recommendations.
"""

from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone

from app.core.config import settings
from app.services.research.fund_factor_service import clean_name, compute_factors
from app.services.research.http_client import fetch_text

COINGECKO_MARKETS = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&order=market_cap_desc&per_page={n}&page=1"
COINGECKO_CHART = "https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart?vs_currency=inr&days=365&interval=daily"

# Not investments — exclude stablecoins and wrapped/derivative tokens.
_EXCLUDE_SYMBOLS = {
    "usdt", "usdc", "dai", "busd", "tusd", "fdusd", "usde", "usds", "pyusd", "usdd", "gusd",
    "wbtc", "weth", "steth", "wsteth", "wbeth", "weeth", "cbbtc", "reth", "lbtc",
}

_CACHE_TTL = 24 * 3600
_CRYPTO_MIN_MONTHS = 10
_UNIVERSE_LIMIT = 15
_FACTOR_CACHE: dict[str, tuple[float, dict]] = {}
_UNIVERSE_CACHE: dict[str, tuple[float, list]] = {}
_HISTORY_CACHE: dict[str, tuple[float, list]] = {}


def _get_json(url: str, timeout: int = 10) -> dict | list | None:
    headers = {}
    if getattr(settings, "coingecko_api_key", ""):
        headers["x-cg-demo-api-key"] = settings.coingecko_api_key
    result = fetch_text(url, timeout=timeout, retries=1, cache_ttl_seconds=_CACHE_TTL, headers=headers, require_json=True)
    if not result.text:
        return None
    try:
        return json.loads(result.text)
    except (ValueError, json.JSONDecodeError):
        return None


def crypto_universe_list() -> list[dict]:
    """Live top coins by market cap (stablecoins/wrapped excluded), cached 24h."""
    cached = _UNIVERSE_CACHE.get("list")
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]
    payload = _get_json(COINGECKO_MARKETS.format(n=_UNIVERSE_LIMIT + 10))
    if not isinstance(payload, list):
        return []
    out: list[dict] = []
    for coin in payload:
        symbol = str(coin.get("symbol", "")).lower()
        coin_id = coin.get("id")
        name = coin.get("name", "")
        if not coin_id or not symbol or symbol in _EXCLUDE_SYMBOLS:
            continue
        out.append({"id": coin_id, "symbol": symbol.upper(), "name": name})
        if len(out) >= _UNIVERSE_LIMIT:
            break
    if out:
        _UNIVERSE_CACHE["list"] = (now, out)
    return out


def load_crypto_history(coin_id: str) -> list[tuple[date, float]] | None:
    cached = _HISTORY_CACHE.get(coin_id)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1] or None
    payload = _get_json(COINGECKO_CHART.format(coin_id=coin_id))
    prices = payload.get("prices") if isinstance(payload, dict) else None
    if not prices:
        return None
    history: list[tuple[date, float]] = []
    for point in prices:
        if isinstance(point, list) and len(point) == 2 and isinstance(point[1], (int, float)) and point[1] > 0:
            d = datetime.fromtimestamp(point[0] / 1000, tz=timezone.utc).date()
            history.append((d, float(point[1])))
    if len(history) < 2:
        return None
    history.sort(key=lambda item: item[0], reverse=True)
    _HISTORY_CACHE[coin_id] = (now, history)
    return history


def crypto_factors(coin_id: str, symbol: str = "", name: str = "") -> dict | None:
    cached = _FACTOR_CACHE.get(coin_id)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]
    history = load_crypto_history(coin_id)
    if not history:
        return None
    metrics = compute_factors(history, "crypto", min_months=_CRYPTO_MIN_MONTHS)
    if not metrics:
        return None
    factors = {
        **metrics,
        "schemeCode": coin_id,
        "ticker": (symbol or coin_id).upper(),
        "name": clean_name(name) if name else coin_id.title(),
        "plan": "Crypto",
    }
    _FACTOR_CACHE[coin_id] = (now, factors)
    return factors


def crypto_universe() -> list[dict]:
    """Factor bundles for the live crypto universe (concurrent, cached 24h)."""
    cached = _UNIVERSE_CACHE.get("factors")
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]
    coins = crypto_universe_list()
    if not coins:
        return []

    def _factor(coin: dict) -> dict | None:
        return crypto_factors(coin["id"], coin["symbol"], coin["name"])

    out: list[dict] = []
    with ThreadPoolExecutor(max_workers=2) as pool:  # CoinGecko free tier is strict
        for f in pool.map(_factor, coins):
            if f:
                out.append(f)
    if out:
        _UNIVERSE_CACHE["factors"] = (now, out)
    return out


def top_crypto_candidates(limit: int = 4, exclude: list[str] | None = None, context=None, goal: dict | None = None) -> list[dict]:
    """Rank the live crypto universe by the (optionally personalized) composite."""
    from app.services.research.fund_factor_service import category_percentiles, score_fund

    universe = crypto_universe()
    if not universe:
        return []
    excluded = {e.strip().lower() for e in (exclude or [])}
    pcts = category_percentiles(universe)
    scored: list[tuple[float, dict, dict]] = []
    for f in universe:
        if f["name"].strip().lower() in excluded or f["ticker"].lower() in excluded:
            continue
        s = score_fund(f, pcts.get(f["schemeCode"], {}), context, goal)
        scored.append((s["score"], f, s))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {"name": f["name"], "ticker": f["ticker"], "coinId": f["schemeCode"], "factors": f, "score": sc, "drivers": s["drivers"], "insights": s["insights"]}
        for sc, f, s in scored[:limit]
    ]


def crypto_ticker_for_name(name: str) -> str:
    """Network-light name->ticker lookup from the cached crypto universe list."""
    if not name:
        return ""
    key = name.strip().lower()
    for coin in crypto_universe_list():
        if coin["name"].strip().lower() == key or coin["symbol"].lower() == key:
            return coin["symbol"]
    return ""


def factors_for_symbol(symbol: str, name: str = "") -> dict | None:
    """Resolve a coin by ticker symbol (e.g. 'BTC') to its factor bundle."""
    sym = symbol.strip().lower()
    for coin in crypto_universe_list():
        if coin["symbol"].lower() == sym or coin["name"].strip().lower() == name.strip().lower():
            return crypto_factors(coin["id"], coin["symbol"], coin["name"])
    return None
