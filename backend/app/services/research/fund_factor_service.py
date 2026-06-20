"""Quantitative factor engine for mutual funds.

This is the analytical brain behind fund recommendations. Instead of ranking on
trailing CAGR alone (the "basic rulebook"), it computes a rich, *risk-adjusted*
factor bundle from each fund's real NAV history (mfapi.in) plus a market
benchmark, then exposes:

- ``fund_factors``        objective per-fund factor bundle (cached, profile-free)
- ``category_candidates`` Direct+Growth candidates for a category, each with factors
- ``category_percentiles``per-factor percentile ranks within a category pool
- ``score_fund``          personalized, goal-aware composite score (pure function)
- ``expected_return_from_factors`` forward return estimate from the fund's own
                          history (replaces the hardcoded return table)

Design notes:
- Returns are computed from NAV, which is already net of expense ratio, so a
  costlier fund mechanically shows weaker risk-adjusted numbers — no separate
  expense feed needed.
- Monthly resampling is used for return-series statistics (robust to the
  irregular spacing in AMFI history).
- Everything is None-safe and degrades to a partial bundle when history is thin;
  callers fall back to category-level behaviour when factors are unavailable.
- Stdlib only (math/statistics); no numpy/pandas dependency.
"""

from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from math import sqrt
from statistics import mean, pstdev

from app.services.research.http_client import fetch_text

MFAPI_SCHEME = "https://api.mfapi.in/mf/{code}"

RISK_FREE_ANNUAL = 6.0  # % — Indian short-term sovereign proxy
_MONTHLY_RF = (1 + RISK_FREE_ANNUAL / 100) ** (1 / 12) - 1

_HISTORY_CACHE: dict[str, tuple[float, list]] = {}
_FACTOR_CACHE: dict[str, tuple[float, dict]] = {}
_CANDIDATE_CACHE: dict[str, tuple[float, list]] = {}
_CACHE_TTL = 24 * 3600
_MIN_NAV_POINTS = 60
_MIN_MONTHS = 18


# ---------------------------------------------------------------------------
# Category specs (shared with fund_picker_service) — category DEFINITIONS, not
# hardcoded assets. ``require`` terms must all appear; any ``exclude`` term
# disqualifies a scheme.
# ---------------------------------------------------------------------------
_PREFERRED_AMCS = [
    "uti", "hdfc", "icici", "sbi", "axis", "kotak", "nippon", "aditya birla",
    "mirae", "dsp", "tata", "bandhan", "franklin", "parag parikh", "ppfas",
    "quant", "motilal", "canara", "invesco", "edelweiss", "sundaram", "lic mf",
]

CATEGORY_SPECS: dict[str, dict] = {
    "large_cap_index": {
        "require": ["nifty 50"],
        "exclude": [
            "next 50", "next50", "junior", "elss", "tax", "midcap", "mid cap",
            "smallcap", "small cap", "midsmall", "equal weight", "bank", "100",
            "200", "500", "it ", "auto", "pharma", "fmcg", "value",
        ],
        "assetKey": "equity",
    },
    "flexi_cap": {"require": ["flexi cap"], "exclude": ["elss", "tax", "index", "etf"], "assetKey": "equity"},
    "mid_cap": {"require": ["mid cap"], "exclude": ["midsmall", "mid smallcap", "index", "etf", "small cap"], "assetKey": "equity"},
    "small_cap": {"require": ["small cap"], "exclude": ["midsmall", "mid smallcap", "index", "etf"], "assetKey": "equity"},
    "elss": {"require": ["elss"], "exclude": ["index", "etf"], "assetKey": "equity"},
    "hybrid": {"require": ["balanced advantage"], "exclude": ["index", "etf", "arbitrage"], "assetKey": "equity"},
    "liquid": {"require": ["liquid"], "exclude": ["plus", "enhanced", "overnight"], "assetKey": "debt"},
    "overnight": {"require": ["overnight"], "exclude": [], "assetKey": "debt"},
    "short_duration": {"require": ["short duration"], "exclude": ["ultra", "low duration"], "assetKey": "debt"},
    "gilt": {"require": ["gilt"], "exclude": ["10 year", "constant"], "assetKey": "debt"},
    "corporate_bond": {"require": ["corporate bond"], "exclude": [], "assetKey": "debt"},
    "banking_psu": {"require": ["banking", "psu"], "exclude": [], "assetKey": "debt"},
    "arbitrage": {"require": ["arbitrage"], "exclude": [], "assetKey": "debt"},
    "gold": {"require": ["gold"], "exclude": ["silver", "mining", "world gold", "global", "international"], "assetKey": "gold"},
}

_GLOBAL_EXCLUDE = ("institutional", "bonus", "segregated", "super inst")
_MAX_CANDIDATES = 10
# Long-run category return anchors used to mean-revert the forward estimate.
_CATEGORY_ANCHOR = {
    "large_cap_index": 11.5, "flexi_cap": 12.5, "mid_cap": 14.0, "small_cap": 15.0,
    "elss": 12.5, "hybrid": 10.0, "liquid": 6.0, "overnight": 5.5,
    "short_duration": 7.0, "gilt": 7.2, "corporate_bond": 7.5, "banking_psu": 7.2,
    "arbitrage": 6.5, "gold": 7.5, "equity_stock": 13.0, "crypto": 12.0,
}


# ---------------------------------------------------------------------------
# Shared low-level helpers (also imported by fund_picker_service)
# ---------------------------------------------------------------------------


def is_direct_growth(name: str) -> bool:
    low = name.lower()
    if "direct" not in low or "growth" not in low:
        return False
    return not any(bad in low for bad in ("idcw", "dividend", "payout", "reinvest"))


def matches_category(name: str, spec: dict) -> bool:
    low = name.lower()
    if not all(term in low for term in spec["require"]):
        return False
    if any(term in low for term in _GLOBAL_EXCLUDE):
        return False
    return not any(term in low for term in spec["exclude"])


def amc_priority(name: str) -> int:
    low = name.lower()
    for idx, amc in enumerate(_PREFERRED_AMCS):
        if amc in low:
            return idx
    return len(_PREFERRED_AMCS)


def clean_name(name: str) -> str:
    """Reduce a raw AMFI scheme name to its core fund name for display."""
    trimmed = re.sub(r"\s*\(formerly[^)]*\)", "", name, flags=re.IGNORECASE).strip()
    marker = re.search(
        r"(\bdirect\b|\bregular\b|growth\s+option|growth\s+plan|[-–]\s*growth\b|\bidcw\b)",
        trimmed,
        flags=re.IGNORECASE,
    )
    cleaned = (trimmed[: marker.start()] if marker else trimmed).strip(" -–·")
    return cleaned or trimmed


def _parse_date(raw: str) -> date | None:
    try:
        return datetime.strptime(raw.strip(), "%d-%m-%Y").date()
    except (ValueError, AttributeError):
        return None


def _trim_at_discontinuity(history: list[tuple[date, float]]) -> list[tuple[date, float]]:
    """Keep only the most recent clean run of NAVs (drop face-value restatements)."""
    for i in range(len(history) - 1):
        newer_nav = history[i][1]
        older_nav = history[i + 1][1]
        if older_nav <= 0:
            return history[: i + 1]
        ratio = newer_nav / older_nav
        if ratio > 1.5 or ratio < 0.667:
            return history[: i + 1]
    return history


def search_candidates(spec: dict, amfi_text: str | None = None) -> list[dict]:
    """Discover Direct+Growth candidates for a category from AMFI's full list."""
    if amfi_text is None:
        from app.services.research.fund_research_service import fetch_amfi_nav_text

        amfi_text = fetch_amfi_nav_text()[0]
    if not amfi_text:
        return []
    seen: set[str] = set()
    candidates: list[dict] = []
    for line in amfi_text.splitlines():
        if ";" not in line:
            continue
        parts = line.split(";")
        if len(parts) < 5:
            continue
        code = parts[0].strip()
        name = parts[3].strip()
        if not code or not code[0].isdigit() or code in seen:
            continue
        if not is_direct_growth(name) or not matches_category(name, spec):
            continue
        seen.add(code)
        candidates.append({"code": code, "name": name, "priority": amc_priority(name)})
    candidates.sort(key=lambda c: c["priority"])
    return candidates[:_MAX_CANDIDATES]


# ---------------------------------------------------------------------------
# NAV history loading
# ---------------------------------------------------------------------------


def load_nav_history(scheme_code: str) -> list[tuple[date, float]] | None:
    """Return cleaned NAV history newest-first, or None if insufficient."""
    cached = _HISTORY_CACHE.get(scheme_code)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1] or None
    url = MFAPI_SCHEME.format(code=scheme_code)
    result = fetch_text(url, timeout=10, retries=1, cache_ttl_seconds=_CACHE_TTL, require_json=True)
    if not result.text:
        return None
    try:
        payload = json.loads(result.text)
    except (ValueError, json.JSONDecodeError):
        return None
    raw = payload.get("data") or []
    meta = payload.get("meta") or {}
    if len(raw) < _MIN_NAV_POINTS:
        return None
    history: list[tuple[date, float]] = []
    for point in raw:
        d = _parse_date(point.get("date", ""))
        try:
            nav = float(point.get("nav"))
        except (TypeError, ValueError):
            nav = 0.0
        if d and nav > 0:
            history.append((d, nav))
    if len(history) < 2:
        return None
    history.sort(key=lambda item: item[0], reverse=True)
    history = _trim_at_discontinuity(history)
    if len(history) < 2:
        return None
    _HISTORY_CACHE[scheme_code] = (now, history)
    # Stash fund-house metadata alongside (separate key) for cheap lookup.
    _HISTORY_CACHE[f"meta:{scheme_code}"] = (now, str(meta.get("fund_house", "")).strip())
    return history


def _fund_house(scheme_code: str) -> str:
    cached = _HISTORY_CACHE.get(f"meta:{scheme_code}")
    return cached[1] if cached else ""


# ---------------------------------------------------------------------------
# Core math
# ---------------------------------------------------------------------------


def _cagr(history: list[tuple[date, float]], years: float) -> float | None:
    """Annualised return over ``years`` using the NAV closest to that age."""
    if len(history) < 2:
        return None
    latest_date, latest_nav = history[0]
    target = date(latest_date.year - int(years), latest_date.month, min(latest_date.day, 28))
    past = next(((d, n) for d, n in history if d <= target), None)
    if not past:
        return None
    past_date, past_nav = past
    span = (latest_date - past_date).days / 365.25
    if span < years * 0.8 or past_nav <= 0:
        return None
    return (pow(latest_nav / past_nav, 1 / span) - 1) * 100


def _return_over(history: list[tuple[date, float]], months: int) -> float | None:
    """Simple (non-annualised) % return over the trailing ``months``."""
    if len(history) < 2:
        return None
    latest_date, latest_nav = history[0]
    y = latest_date.year - (months // 12)
    m = latest_date.month - (months % 12)
    if m <= 0:
        m += 12
        y -= 1
    target = date(y, m, min(latest_date.day, 28))
    # Clamp to the oldest point when the lookback predates available history
    # (e.g. 12m momentum on a ~1y crypto series), as long as most of the window
    # is covered, so the measure is the return over the available period.
    past = next(((d, n) for d, n in history if d <= target), None)
    if not past:
        oldest = history[-1]
        if (latest_date - oldest[0]).days >= months * 30 * 0.6:
            past = oldest
    if not past or past[1] <= 0:
        return None
    return (latest_nav / past[1] - 1) * 100


def _since_inception_cagr(history: list[tuple[date, float]]) -> float | None:
    latest_date, latest_nav = history[0]
    first_date, first_nav = history[-1]
    span = (latest_date - first_date).days / 365.25
    # Accept ~11 months+ so a full year of daily data (e.g. CoinGecko's 365-day
    # cap, which works out to span ~0.999) still yields an annualised number.
    if span < 0.9 or first_nav <= 0:
        return None
    return (pow(latest_nav / first_nav, 1 / span) - 1) * 100


def _monthly_series(history: list[tuple[date, float]]) -> list[tuple[date, float]]:
    """Resample to one NAV per calendar month (last available), chronological."""
    chrono = sorted(history, key=lambda item: item[0])
    by_month: dict[tuple[int, int], tuple[date, float]] = {}
    for d, nav in chrono:
        by_month[(d.year, d.month)] = (d, nav)
    return [by_month[key] for key in sorted(by_month)]


def _returns(series: list[float]) -> list[float]:
    out = []
    for i in range(1, len(series)):
        if series[i - 1] > 0:
            out.append(series[i] / series[i - 1] - 1)
    return out


def _max_drawdown(navs: list[float]) -> float | None:
    if len(navs) < 2:
        return None
    peak = navs[0]
    worst = 0.0
    for nav in navs:
        peak = max(peak, nav)
        if peak > 0:
            worst = min(worst, (nav - peak) / peak)
    return worst * 100


def _current_drawdown(navs: list[float]) -> float | None:
    if not navs:
        return None
    peak = max(navs)
    return ((navs[-1] - peak) / peak) * 100 if peak > 0 else None


def _recovery_months(monthly: list[tuple[date, float]]) -> int | None:
    """Longest stretch (months) spent below a prior NAV peak before recovering."""
    if len(monthly) < 3:
        return None
    peak_nav = monthly[0][1]
    peak_idx = 0
    longest = 0
    for i, (_, nav) in enumerate(monthly):
        if nav >= peak_nav:
            longest = max(longest, i - peak_idx)
            peak_nav = nav
            peak_idx = i
    longest = max(longest, len(monthly) - 1 - peak_idx)  # ongoing drawdown
    return longest


def _downside_deviation(returns: list[float]) -> float | None:
    if not returns:
        return None
    downs = [min(r - _MONTHLY_RF, 0) ** 2 for r in returns]
    return sqrt(mean(downs)) * sqrt(12) * 100 if downs else None


def _rolling_cagr(monthly: list[tuple[date, float]], window: int = 36) -> list[float]:
    out = []
    navs = [nav for _, nav in monthly]
    for i in range(len(navs) - window):
        start, end = navs[i], navs[i + window]
        if start > 0:
            out.append((pow(end / start, 12 / window) - 1) * 100)
    return out


def _align(fund_monthly: list[tuple[date, float]], bench_monthly: list[tuple[date, float]]) -> tuple[list[float], list[float]]:
    """Return aligned monthly-return pairs over the common month set."""
    bench_by_month = {(d.year, d.month): nav for d, nav in bench_monthly}
    common: list[tuple[date, float, float]] = []
    for d, nav in fund_monthly:
        key = (d.year, d.month)
        if key in bench_by_month:
            common.append((d, nav, bench_by_month[key]))
    common.sort(key=lambda item: item[0])
    fund_r, bench_r = [], []
    for i in range(1, len(common)):
        pf, pb = common[i - 1][1], common[i - 1][2]
        if pf > 0 and pb > 0:
            fund_r.append(common[i][1] / pf - 1)
            bench_r.append(common[i][2] / pb - 1)
    return fund_r, bench_r


def _covariance(xs: list[float], ys: list[float]) -> float:
    mx, my = mean(xs), mean(ys)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / len(xs)


def _correlation(xs: list[float], ys: list[float]) -> float | None:
    n = min(len(xs), len(ys))
    if n < 12:
        return None
    xs, ys = xs[-n:], ys[-n:]
    sx, sy = pstdev(xs), pstdev(ys)
    if sx == 0 or sy == 0:
        return None
    return _covariance(xs, ys) / (sx * sy)


# ---------------------------------------------------------------------------
# Benchmark (Nifty 50 index-fund NAV, discovered dynamically — used only as a
# market reference for beta/alpha/capture; it is NOT a recommended asset).
# ---------------------------------------------------------------------------


def _benchmark_monthly(amfi_text: str | None = None) -> list[tuple[date, float]] | None:
    cached = _HISTORY_CACHE.get("benchmark:nifty50")
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1] or None
    candidates = search_candidates(CATEGORY_SPECS["large_cap_index"], amfi_text)
    best: list[tuple[date, float]] | None = None
    for cand in candidates[:4]:
        hist = load_nav_history(cand["code"])
        if hist and (best is None or len(hist) > len(best)):
            best = hist
    monthly = _monthly_series(best) if best else None
    _HISTORY_CACHE["benchmark:nifty50"] = (now, monthly or [])
    return monthly


# ---------------------------------------------------------------------------
# Factor bundle
# ---------------------------------------------------------------------------


def compute_factors(history: list[tuple[date, float]], asset_key: str, benchmark_monthly: list[tuple[date, float]] | None = None, min_months: int = _MIN_MONTHS) -> dict | None:
    """Source-agnostic factor bundle from a date->value series (NAV or price).

    Used by funds (mfapi NAV), equities (Yahoo close), and crypto (CoinGecko).
    Returns metric fields only; callers add identity. None if history is thin.
    ``min_months`` lets crypto (free CoinGecko history is capped at ~1y) compute a
    meaningful partial bundle (vol/drawdown/Sortino/momentum; 3Y metrics stay None).
    """
    if not history or len(history) < 2:
        return None
    monthly = _monthly_series(history)
    if len(monthly) < min_months:
        return None
    monthly_navs = [nav for _, nav in monthly]
    monthly_rets = _returns(monthly_navs)
    chrono = sorted(history, key=lambda x: x[0])
    chrono_navs = [nav for _, nav in chrono]
    # Drawdown over a common recent window (last 3y) so assets of different ages
    # compare apples-to-apples — all-time maxDD unfairly flatters new assets that
    # never lived through an old crash.
    latest_d = history[0][0]
    cutoff = date(latest_d.year - 3, latest_d.month, min(latest_d.day, 28))
    navs_3y = [nav for d, nav in chrono if d >= cutoff]
    max_dd_3y = _max_drawdown(navs_3y) if len(navs_3y) >= 12 else None

    cagr3 = _cagr(history, 3)
    cagr5 = _cagr(history, 5)
    since = _since_inception_cagr(history)
    ret_measure = next((v for v in (cagr3, cagr5, since) if v is not None), None)

    vol = pstdev(monthly_rets) * sqrt(12) * 100 if len(monthly_rets) >= 6 else None
    downside = _downside_deviation(monthly_rets)
    max_dd = _max_drawdown(chrono_navs)
    cur_dd = _current_drawdown(chrono_navs)
    recovery = _recovery_months(monthly)

    sharpe = (ret_measure - RISK_FREE_ANNUAL) / vol if (ret_measure is not None and vol) else None
    sortino = (ret_measure - RISK_FREE_ANNUAL) / downside if (ret_measure is not None and downside) else None
    calmar_dd = max_dd_3y if max_dd_3y is not None else max_dd
    calmar = ret_measure / abs(calmar_dd) if (ret_measure is not None and calmar_dd) else None

    rolling = _rolling_cagr(monthly, 36)
    rolling_mean = mean(rolling) if rolling else None
    rolling_std = pstdev(rolling) if len(rolling) >= 2 else None

    factors = {
        "assetKey": asset_key,
        "latestNav": round(history[0][1], 4),
        "navDate": history[0][0].strftime("%d-%m-%Y"),
        "historyYears": round((history[0][0] - history[-1][0]).days / 365.25, 1),
        "cagr1y": _round(_cagr(history, 1)),
        "cagr3y": _round(cagr3),
        "cagr5y": _round(cagr5),
        "cagr7y": _round(_cagr(history, 7)),
        "cagrSinceInception": _round(since),
        "volatility": _round(vol),
        "maxDrawdown": _round(max_dd),
        "maxDrawdown3y": _round(max_dd_3y if max_dd_3y is not None else max_dd),
        "currentDrawdown": _round(cur_dd),
        "downsideDeviation": _round(downside),
        "recoveryMonths": recovery,
        "sharpe": _round(sharpe, 2),
        "sortino": _round(sortino, 2),
        "calmar": _round(calmar, 2),
        "momentum6m": _round(_return_over(history, 6)),
        "momentum12m": _round(_return_over(history, 12)),
        "rollingMean3y": _round(rolling_mean),
        "rollingStd3y": _round(rolling_std),
        "rollingWindows": len(rolling),
        "dataMode": "live",
    }
    if asset_key in {"equity", "tactical"} and benchmark_monthly:
        factors.update(_benchmark_metrics(monthly, benchmark_monthly, ret_measure))
    return factors


def fund_factors(scheme_code: str, name: str = "", asset_key: str = "equity", amfi_text: str | None = None) -> dict | None:
    """Objective, profile-free factor bundle for a mutual-fund scheme (cached 24h)."""
    cache_key = f"{scheme_code}:{asset_key}"
    cached = _FACTOR_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    history = load_nav_history(scheme_code)
    if not history:
        return None
    benchmark = _benchmark_monthly(amfi_text) if asset_key == "equity" else None
    metrics = compute_factors(history, asset_key, benchmark)
    if not metrics:
        return None
    factors = {
        **metrics,
        "schemeCode": scheme_code,
        "name": clean_name(name) if name else clean_name(scheme_code),
        "fundHouse": _fund_house(scheme_code),
        "plan": "Direct - Growth",
    }
    _FACTOR_CACHE[cache_key] = (now, factors)
    return factors


def _benchmark_metrics(fund_monthly, bench_monthly, fund_cagr) -> dict:
    fund_r, bench_r = _align(fund_monthly, bench_monthly)
    if len(fund_r) < 12:
        return {}
    var_b = pstdev(bench_r) ** 2
    beta = _covariance(fund_r, bench_r) / var_b if var_b else None
    # Benchmark CAGR over the common window.
    bench_navs = [nav for _, nav in bench_monthly]
    bench_cagr = None
    if len(bench_navs) >= 13:
        months = min(len(bench_navs) - 1, 60)
        start = bench_navs[-(months + 1)]
        if start > 0:
            bench_cagr = (pow(bench_navs[-1] / start, 12 / months) - 1) * 100
    alpha = None
    if beta is not None and fund_cagr is not None and bench_cagr is not None:
        alpha = fund_cagr - (RISK_FREE_ANNUAL + beta * (bench_cagr - RISK_FREE_ANNUAL))

    up_b = [(f, b) for f, b in zip(fund_r, bench_r) if b > 0]
    down_b = [(f, b) for f, b in zip(fund_r, bench_r) if b < 0]
    up_capture = (mean([f for f, _ in up_b]) / mean([b for _, b in up_b])) if up_b and mean([b for _, b in up_b]) else None
    down_capture = (mean([f for f, _ in down_b]) / mean([b for _, b in down_b])) if down_b and mean([b for _, b in down_b]) else None

    diff = [f - b for f, b in zip(fund_r, bench_r)]
    te = pstdev(diff) * sqrt(12) * 100 if len(diff) >= 6 else None
    info_ratio = ((fund_cagr - bench_cagr) / te) if (te and fund_cagr is not None and bench_cagr is not None) else None

    return {
        "beta": _round(beta, 2),
        "alpha": _round(alpha),
        "benchmarkCagr": _round(bench_cagr),
        "upCapture": _round(up_capture, 2),
        "downCapture": _round(down_capture, 2),
        "trackingError": _round(te),
        "infoRatio": _round(info_ratio, 2),
    }


def category_candidates(category_key: str, amfi_text: str | None = None, limit: int = _MAX_CANDIDATES) -> list[dict]:
    """Direct+Growth candidates for a category, each carrying a factor bundle."""
    spec = CATEGORY_SPECS.get(category_key)
    if not spec:
        return []
    cache_key = f"{category_key}:{limit}"
    cached = _CANDIDATE_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    raw = search_candidates(spec, amfi_text)
    if not raw:
        return []
    asset_key = spec["assetKey"]

    def _factor(cand: dict) -> dict | None:
        f = fund_factors(cand["code"], cand["name"], asset_key, amfi_text)
        if f:
            f = dict(f)
            f["categoryKey"] = category_key
            f["priority"] = cand["priority"]
        return f

    out: list[dict] = []
    with ThreadPoolExecutor(max_workers=min(len(raw), 6)) as pool:
        for f in pool.map(_factor, raw):
            if f:
                out.append(f)
    if out:
        _CANDIDATE_CACHE[cache_key] = (now, out)
    return out


def _round(value: float | None, places: int = 1) -> float | None:
    return round(value, places) if isinstance(value, (int, float)) else None


def monthly_returns(scheme_code: str) -> list[float] | None:
    """Monthly return series for a scheme (chronological), or None."""
    history = load_nav_history(scheme_code)
    if not history:
        return None
    navs = [nav for _, nav in _monthly_series(history)]
    rets = _returns(navs)
    return rets or None


# ---------------------------------------------------------------------------
# Diversification / relationship layer (vs the user's existing holdings)
# ---------------------------------------------------------------------------


def diversification_insight(scheme_code: str, holding_codes: list[str], selected_codes: list[str]) -> dict:
    """How much a candidate diversifies vs what the user already owns / picked.

    Correlation uses monthly returns over the common window. Lower correlation to
    existing holdings = genuine diversification; very high correlation to an
    already-selected pick = redundancy. Returns structured insight + a score
    delta the caller can fold into the composite.
    """
    cand_r = monthly_returns(scheme_code)
    if not cand_r:
        return {"correlationToHoldings": None, "diversifies": None, "redundant": False, "scoreDelta": 0}

    def _max_corr(codes: list[str]) -> tuple[float | None, str | None]:
        best: float | None = None
        best_code: str | None = None
        for code in codes:
            if code == scheme_code:
                return 1.0, code
            other = monthly_returns(code)
            if not other:
                continue
            n = min(len(cand_r), len(other))
            c = _correlation(cand_r[-n:], other[-n:])
            if c is not None and (best is None or c > best):
                best, best_code = c, code
        return best, best_code

    corr_holdings, _ = _max_corr([c for c in holding_codes if c])
    corr_selected, redundant_code = _max_corr([c for c in selected_codes if c])

    diversifies = corr_holdings is not None and corr_holdings < 0.8
    redundant = corr_selected is not None and corr_selected > 0.92

    # Reward genuine diversification, penalize a near-duplicate of an existing pick.
    score_delta = 0
    if corr_holdings is not None:
        if corr_holdings < 0.6:
            score_delta += 5
        elif corr_holdings > 0.9:
            score_delta -= 4
    if redundant:
        score_delta -= 12

    return {
        "correlationToHoldings": _round(corr_holdings, 2),
        "correlationToSelected": _round(corr_selected, 2),
        "diversifies": diversifies,
        "redundant": redundant,
        "redundantWith": redundant_code if redundant else None,
        "scoreDelta": score_delta,
    }


# ---------------------------------------------------------------------------
# Percentile ranking within a category pool
# ---------------------------------------------------------------------------

# factor -> direction (+1: higher is better, -1: lower is better)
SCORING_FACTORS = {
    "sortino": 1, "calmar": 1, "sharpe": 1, "alpha": 1, "infoRatio": 1,
    "rollingMean3y": 1, "rollingStd3y": -1, "maxDrawdown3y": 1, "downsideDeviation": -1,
    "downCapture": -1, "volatility": -1, "momentum12m": 1, "cagr3y": 1,
}

_FACTOR_LABEL = {
    "sortino": "risk-adjusted return (Sortino)",
    "calmar": "return per unit of drawdown (Calmar)",
    "sharpe": "risk-adjusted return (Sharpe)",
    "alpha": "outperformance vs Nifty 50 (alpha)",
    "infoRatio": "consistency of benchmark-beating (information ratio)",
    "rollingMean3y": "average rolling 3Y return",
    "rollingStd3y": "return consistency (low rolling-return swing)",
    "maxDrawdown3y": "shallow worst-case drawdown (last 3y)",
    "downsideDeviation": "low downside volatility",
    "downCapture": "falls less than the market in down months",
    "volatility": "low overall volatility",
    "momentum12m": "12-month momentum",
    "cagr3y": "3-year return",
}


def category_percentiles(candidates: list[dict]) -> dict[str, dict[str, float]]:
    """Per-scheme, per-factor percentile (0-100, 100 = best) within the pool."""
    result: dict[str, dict[str, float]] = {c["schemeCode"]: {} for c in candidates}
    for factor, direction in SCORING_FACTORS.items():
        pairs = [(c["schemeCode"], c.get(factor)) for c in candidates if isinstance(c.get(factor), (int, float))]
        if len(pairs) < 2:
            continue
        for code, value in pairs:
            worse = sum(
                1
                for other_code, other in pairs
                if other_code != code and ((other < value) if direction == 1 else (other > value))
            )
            result[code][factor] = round(worse / (len(pairs) - 1) * 100)
    return result


# ---------------------------------------------------------------------------
# Personalized, goal-aware composite score
# ---------------------------------------------------------------------------

_BASE_WEIGHTS = {
    "sortino": 0.18, "calmar": 0.12, "sharpe": 0.08, "alpha": 0.10, "infoRatio": 0.06,
    "rollingMean3y": 0.06, "rollingStd3y": 0.06, "maxDrawdown3y": 0.10, "downsideDeviation": 0.04,
    "downCapture": 0.08, "volatility": 0.02, "momentum12m": 0.06, "cagr3y": 0.04,
}


def _personalized_weights(context, horizon_months: int) -> dict[str, float]:
    w = dict(_BASE_WEIGHTS)
    near_term = horizon_months and horizon_months <= 36
    long_term = horizon_months and horizon_months >= 84

    if near_term:
        # Protect capital for near-term goals.
        for k, bump in (("maxDrawdown3y", 0.10), ("downsideDeviation", 0.06), ("downCapture", 0.06), ("volatility", 0.04)):
            w[k] += bump
        for k, cut in (("momentum12m", 0.04), ("cagr3y", 0.02), ("alpha", 0.04), ("calmar", 0.02)):
            w[k] = max(0, w[k] - cut)
    elif long_term:
        # Reward compounding quality over a long runway.
        for k, bump in (("sortino", 0.06), ("calmar", 0.04), ("alpha", 0.04), ("momentum12m", 0.03)):
            w[k] += bump
        w["volatility"] = max(0, w["volatility"] - 0.02)

    if getattr(context, "panic_risk", False):
        # A user who sells in crashes needs funds that fall less.
        for k, bump in (("downCapture", 0.10), ("maxDrawdown3y", 0.08), ("downsideDeviation", 0.04)):
            w[k] += bump
        for k, cut in (("momentum12m", 0.04), ("cagr3y", 0.02)):
            w[k] = max(0, w[k] - cut)
    if getattr(context, "disciplined", False) and long_term:
        for k, bump in (("alpha", 0.04), ("momentum12m", 0.03), ("sortino", 0.03)):
            w[k] += bump
    return w


def score_fund(factors: dict, percentiles: dict[str, float], context=None, goal: dict | None = None) -> dict:
    """Personalized 0-100 composite from category-relative percentiles.

    ``percentiles`` is this fund's percentile map (from ``category_percentiles``).
    Returns {score, weightedFrom, drivers, insights}. Pure function.
    """
    horizon_months = int((goal or {}).get("timeHorizonMonths") or 0)
    weights = _personalized_weights(context, horizon_months)

    contributions: list[tuple[str, float, float]] = []  # (factor, pct, weight)
    total_w = 0.0
    acc = 0.0
    for factor, weight in weights.items():
        pct = percentiles.get(factor)
        if pct is None:
            continue
        acc += pct * weight
        total_w += weight
        contributions.append((factor, pct, weight))
    score = round(acc / total_w) if total_w else 50

    # A short track record is less proven — mild haircut so a brand-new fund
    # doesn't top the list purely on a flattering, crash-free short history.
    years = factors.get("historyYears") or 0
    if years < 3:
        score = round(score * 0.90)
    elif years < 5:
        score = round(score * 0.96)

    # Drivers: top factors where this fund ranks well, weighted by importance.
    ranked = sorted(contributions, key=lambda c: c[1] * c[2], reverse=True)
    drivers = [
        (
            f"Best in category for {_FACTOR_LABEL.get(factor, factor)}"
            if pct >= 90
            else f"Better than {round(pct)}% of peers on {_FACTOR_LABEL.get(factor, factor)}"
        )
        for factor, pct, _ in ranked[:3]
        if pct >= 60
    ]

    insights = {
        "compositeScore": score,
        "sortino": factors.get("sortino"),
        "calmar": factors.get("calmar"),
        "maxDrawdown": factors.get("maxDrawdown"),
        "downCapture": factors.get("downCapture"),
        "alpha": factors.get("alpha"),
        "volatility": factors.get("volatility"),
        "sortinoPercentile": percentiles.get("sortino"),
        "drawdownPercentile": percentiles.get("maxDrawdown3y"),
        "downCapturePercentile": percentiles.get("downCapture"),
        "maxDrawdown3y": factors.get("maxDrawdown3y"),
        "historyYears": factors.get("historyYears"),
    }
    return {"score": score, "drivers": drivers, "insights": insights}


# ---------------------------------------------------------------------------
# Forward expected return derived from the fund's own history
# ---------------------------------------------------------------------------


def expected_return_from_factors(factors: dict, category_key: str, regime: dict | None = None) -> dict | None:
    """Conservative forward return estimate from the fund's history.

    Mean-reverts the fund's own long-run CAGR toward a category anchor (so we do
    not extrapolate a recent hot streak), then haircuts for regime and the fund's
    own volatility/uncertainty. Mirrors the dict shape of the old static table.
    """
    anchor = _CATEGORY_ANCHOR.get(category_key)
    if anchor is None:
        return None
    long_cagr = next((factors.get(k) for k in ("cagr5y", "cagrSinceInception", "cagr3y") if factors.get(k) is not None), None)
    base = anchor if long_cagr is None else 0.55 * anchor + 0.45 * long_cagr

    regime_name = (regime or {}).get("regime", "limited-data")
    base += {"risk-on": 0.5, "risk-off": -1.5, "limited-data": -0.5}.get(regime_name, 0.0)

    vol = factors.get("volatility") or 0
    # Wider band (more uncertainty) for more volatile funds.
    spread = max(1.5, min(6.0, vol / 4)) if vol else 2.5
    base = round(base, 1)
    conservative = round(base - spread, 1)
    aggressive = round(base + spread, 1)
    return {
        "label": f"{conservative:g}-{aggressive:g}% CAGR",
        "cagrRange": f"{conservative:g}-{aggressive:g}%",
        "expectedCagr": base,
        "conservative": conservative,
        "base": base,
        "aggressive": aggressive,
        "inflationAdjustedBase": round(base - 6.0, 1),
        "inflationAssumption": 6.0,
        "assumptions": (
            f"Estimated from this fund's own {factors.get('historyYears', '?')}-year NAV history "
            f"(long-run CAGR mean-reverted toward the category norm and haircut for {regime_name} "
            "conditions and the fund's volatility)."
        ),
        "disclaimer": "Expected return is an assumption range, not a promise of future results.",
    }
