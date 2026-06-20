"""Quantitative factor engine for equities (stocks + ETFs).

The equity counterpart of ``fund_factor_service``: it builds the candidate
universe from **live NSE index constituents** (no hardcoded tickers) and computes
the same risk-adjusted factor bundle from real Yahoo Finance price history,
reusing ``fund_factor_service.compute_factors`` and the shared scoring/percentile
helpers. The market benchmark is the Nifty 50 (``^NSEI``) from Yahoo.

Everything is cached 24h and degrades safely (empty universe / partial bundle)
so a network failure never breaks recommendations.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from urllib.parse import quote

from app.services.research.fund_factor_service import _monthly_series, clean_name, compute_factors
from app.services.research.http_client import fetch_text

# query2 is far less rate-limited than query1 for anonymous access; we try it
# first and fall back to query1.
_YAHOO_HOSTS = ("query2.finance.yahoo.com", "query1.finance.yahoo.com")
YAHOO_CHART = "https://{host}/v8/finance/chart/{sym}?range=10y&interval={interval}"
YAHOO_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search?q={q}&quotesCount=6&newsCount=0"

# Live NSE index membership = the research-grounded equity universe.
NSE_INDEX_CSVS = {
    "nifty50": "https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv",
    "niftynext50": "https://nsearchives.nseindia.com/content/indices/ind_niftynext50list.csv",
}
# Cap how many constituents we compute factors for, to stay gentle on Yahoo.
_UNIVERSE_LIMIT = 60
# NSE/Yahoo reject the default bot UA — present a browser UA.
_BROWSER = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

_CACHE_TTL = 24 * 3600
_PRICE_CACHE: dict[str, tuple[float, list]] = {}
_FACTOR_CACHE: dict[str, tuple[float, dict]] = {}
_UNIVERSE_CACHE: dict[str, tuple[float, list]] = {}
_TICKER_CACHE: dict[str, tuple[float, str]] = {}


# ---------------------------------------------------------------------------
# Yahoo session — anonymous query1/query2 access is hard-rate-limited (429);
# a cookie + crumb session (via curl, which handles Yahoo's consent cookie)
# makes it reliable even for bulk requests.
# ---------------------------------------------------------------------------
_COOKIE_FILE = os.path.join(tempfile.gettempdir(), "aim_yahoo_cookies.txt")
_SESSION: dict = {"crumb": "", "cookie": "", "ts": 0.0}
_SESSION_TTL = 1800
_UA = _BROWSER["User-Agent"]


def _curl(args: list[str], timeout: int = 12) -> str:
    try:
        proc = subprocess.run(
            ["curl", "-sS", "--max-time", str(timeout), "-A", _UA, *args],
            capture_output=True, text=True, timeout=timeout + 2, check=False,
        )
        return proc.stdout or ""
    except (OSError, subprocess.SubprocessError):
        return ""


def _read_cookie_header() -> str:
    """Parse curl's Netscape cookie jar into a Cookie header string."""
    pairs: list[str] = []
    try:
        with open(_COOKIE_FILE, encoding="utf-8", errors="ignore") as fh:
            for raw in fh:
                line = raw[len("#HttpOnly_"):] if raw.startswith("#HttpOnly_") else raw
                if line.startswith("#") or "\t" not in line:
                    continue
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 7 and parts[5]:
                    pairs.append(f"{parts[5]}={parts[6]}")
    except OSError:
        return ""
    return "; ".join(pairs)


def _yahoo_auth() -> tuple[str, str]:
    """Return (cookie_header, crumb), refreshed every 30 min. Empty on failure."""
    now = time.time()
    if _SESSION["crumb"] and _SESSION["cookie"] and now - _SESSION["ts"] < _SESSION_TTL:
        return _SESSION["cookie"], _SESSION["crumb"]
    _curl(["-c", _COOKIE_FILE, "-o", os.devnull, "https://fc.yahoo.com"])  # sets consent cookie
    crumb = _curl(["-b", _COOKIE_FILE, "https://query2.finance.yahoo.com/v1/test/getcrumb"]).strip()
    if len(crumb) > 24 or "<" in crumb or "Too Many" in crumb:
        crumb = ""  # guard against error pages / rate-limit responses
    cookie = _read_cookie_header()
    if crumb and cookie:
        _SESSION.update(crumb=crumb, cookie=cookie, ts=now)
    return cookie, crumb


def _yahoo_fetch(url: str) -> str:
    """Authenticated Yahoo GET via fetch_text (so results are disk-cached and
    survive restarts / partial throttling). Falls back to an un-crumbed request,
    which succeeds on query2 when the IP is not rate-limited."""
    cookie, crumb = _yahoo_auth()
    headers = {**_BROWSER, **({"Cookie": cookie} if cookie else {})}
    attempts = []
    if crumb:
        attempts.append(f"{url}&crumb={quote(crumb)}")
    attempts.append(url)  # un-crumbed fallback
    for full in attempts:
        result = fetch_text(full, timeout=12, retries=1, cache_ttl_seconds=_CACHE_TTL, require_json=True, headers=headers)
        if result.text:
            return result.text
    return ""


# ---------------------------------------------------------------------------
# Price history (Yahoo)
# ---------------------------------------------------------------------------


def _parse_chart(text: str) -> list[tuple[date, float]]:
    try:
        payload = json.loads(text)
    except (ValueError, json.JSONDecodeError):
        return []
    result = (payload.get("chart", {}).get("result") or [{}])[0]
    stamps = result.get("timestamp") or []
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes = quote.get("close") or []
    out: list[tuple[date, float]] = []
    for ts, close in zip(stamps, closes):
        if isinstance(close, (int, float)) and close > 0 and isinstance(ts, (int, float)):
            out.append((datetime.fromtimestamp(ts, tz=timezone.utc).date(), float(close)))
    return out


def load_price_history(symbol: str, interval: str = "1d") -> list[tuple[date, float]] | None:
    """Yahoo daily close history newest-first (cached 24h)."""
    cache_key = f"{symbol}:{interval}"
    cached = _PRICE_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1] or None
    history: list[tuple[date, float]] = []
    for host in _YAHOO_HOSTS:
        url = YAHOO_CHART.format(host=host, sym=quote(symbol, safe=""), interval=interval)
        text = _yahoo_fetch(url)
        if text:
            history = _parse_chart(text)
            if len(history) >= 2:
                break
    if len(history) < 2:
        return None
    history.sort(key=lambda item: item[0], reverse=True)
    _PRICE_CACHE[cache_key] = (now, history)
    return history


def _benchmark_monthly() -> list[tuple[date, float]] | None:
    cached = _PRICE_CACHE.get("benchmark:^NSEI")
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1] or None
    hist = load_price_history("^NSEI", interval="1mo")
    monthly = _monthly_series(hist) if hist else None
    _PRICE_CACHE["benchmark:^NSEI"] = (now, monthly or [])
    return monthly


# ---------------------------------------------------------------------------
# Universe (live NSE constituents)
# ---------------------------------------------------------------------------


def _parse_nse_csv(text: str) -> list[dict]:
    rows: list[dict] = []
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return rows
    header = [h.strip().lower() for h in lines[0].split(",")]
    try:
        i_name = header.index("company name")
        i_industry = header.index("industry")
        i_symbol = header.index("symbol")
    except ValueError:
        return rows
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) <= max(i_name, i_industry, i_symbol):
            continue
        symbol = parts[i_symbol].strip()
        name = parts[i_name].strip()
        if symbol and name:
            rows.append({"name": name, "symbol": f"{symbol}.NS", "industry": parts[i_industry].strip()})
    return rows


def constituents() -> list[dict]:
    """Live NSE Nifty 50 + Next 50 membership (cached 24h). Deduped by symbol."""
    cached = _UNIVERSE_CACHE.get("constituents")
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]
    seen: set[str] = set()
    out: list[dict] = []
    for url in NSE_INDEX_CSVS.values():
        result = fetch_text(url, timeout=10, retries=1, cache_ttl_seconds=_CACHE_TTL, headers=_BROWSER)
        for row in _parse_nse_csv(result.text):
            if row["symbol"] not in seen:
                seen.add(row["symbol"])
                out.append(row)
    if out:
        _UNIVERSE_CACHE["constituents"] = (now, out)
    return out


# ---------------------------------------------------------------------------
# Factor bundle
# ---------------------------------------------------------------------------


def equity_factors(symbol: str, name: str = "", industry: str = "") -> dict | None:
    """Objective factor bundle for an equity symbol (cached 24h)."""
    cached = _FACTOR_CACHE.get(symbol)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]
    history = load_price_history(symbol)
    if not history:
        return None
    metrics = compute_factors(history, "equity", _benchmark_monthly())
    if not metrics:
        return None
    factors = {
        **metrics,
        "ticker": symbol,
        "schemeCode": symbol,  # generic id used by scoring/percentiles
        "name": clean_name(name) if name else symbol.replace(".NS", ""),
        "industry": industry,
        "plan": "Direct equity",
    }
    _FACTOR_CACHE[symbol] = (now, factors)
    return factors


def equity_universe(limit: int | None = None) -> list[dict]:
    """Factor bundles for the live NSE universe (concurrent, cached 24h)."""
    cache_key = f"universe:{limit}"
    cached = _UNIVERSE_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]
    members = constituents()
    if not members:
        return []
    members = members[: limit or _UNIVERSE_LIMIT]

    def _factor(member: dict) -> dict | None:
        return equity_factors(member["symbol"], member["name"], member.get("industry", ""))

    out: list[dict] = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        for f in pool.map(_factor, members):
            if f:
                out.append(f)
    if out:
        _UNIVERSE_CACHE[cache_key] = (now, out)
    return out


def top_equity_candidates(limit: int = 12, exclude: list[str] | None = None, context=None, goal: dict | None = None) -> list[dict]:
    """Rank the live equity universe by the (optionally personalized) factor
    composite and return the top candidates with their factor bundles."""
    from app.services.research.fund_factor_service import category_percentiles, score_fund

    universe = equity_universe()
    if not universe:
        return []
    excluded = {e.strip().lower() for e in (exclude or [])}
    pcts = category_percentiles(universe)
    scored: list[tuple[float, dict, dict]] = []
    for f in universe:
        if f["name"].strip().lower() in excluded:
            continue
        s = score_fund(f, pcts.get(f["schemeCode"], {}), context, goal)
        scored.append((s["score"], f, s))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "name": f["name"],
            "ticker": f["ticker"],
            "industry": f.get("industry", ""),
            "factors": f,
            "score": sc,
            "drivers": s["drivers"],
            "insights": s["insights"],
        }
        for sc, f, s in scored[:limit]
    ]


# ---------------------------------------------------------------------------
# Ticker resolution (replaces hardcoded ticker maps)
# ---------------------------------------------------------------------------


def ticker_from_constituents(name: str) -> str:
    """Network-free name->NSE ticker lookup from the cached constituent list."""
    if not name:
        return ""
    key = name.strip().lower()
    for member in constituents():
        m = member["name"].strip().lower()
        if m == key or m.startswith(key) or key.startswith(m):
            return member["symbol"]
    return ""


def ticker_for_name(name: str) -> str:
    """Resolve a company name to its NSE ticker via the live universe, else Yahoo
    search. Returns '' if unresolved. Cached."""
    if not name:
        return ""
    key = name.strip().lower()
    cached = _TICKER_CACHE.get(key)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]
    resolved = ""
    for member in constituents():
        if member["name"].strip().lower() == key or member["name"].strip().lower().startswith(key):
            resolved = member["symbol"]
            break
    if not resolved:
        text = _yahoo_fetch(YAHOO_SEARCH.format(q=quote(name, safe="")))
        try:
            quotes = json.loads(text).get("quotes", []) if text else []
        except (ValueError, json.JSONDecodeError):
            quotes = []
        # Prefer the NSE listing.
        nse = next((q for q in quotes if str(q.get("symbol", "")).endswith(".NS")), None)
        resolved = (nse or (quotes[0] if quotes else {})).get("symbol", "") if quotes else ""
    _TICKER_CACHE[key] = (now, resolved)
    return resolved
