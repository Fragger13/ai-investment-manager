"""Fund research ingestion from AMFI.

Each category (large-cap index, liquid, flexi-cap, gold, …) is resolved to a
**specific, named scheme** so the user does not have to do the extra work of
choosing which fund to buy. Selection is data-driven: among Direct + Growth
plans from major AMCs, funds are ranked by trailing returns computed from NAV
history (returns are net of expense ratio, so the cheaper/better fund wins) —
see ``fund_picker_service``. The top pick becomes the recommendation's
``instrumentName``; runner-up funds and the trailing returns are surfaced in
the summary. Real AMFI scheme matches stay attached as evidence.

If the picker can't resolve a category (network down, no match), the entry
falls back to a brand-neutral category label as before.
"""

from __future__ import annotations

from app.services.intelligence import now_iso
from app.services.research.http_client import fetch_text


AMFI_NAV_URLS = [
    "https://portal.amfiindia.com/spages/NAVOpen.txt",
    "https://www.amfiindia.com/spages/NAVOpen.txt",
]

# Category-level filters. Each entry searches AMFI NAV text for matching
# schemes and emits a GENERIC instrument label. The matched schemes attach
# as evidence so the user can verify, but the recommendation itself stays
# brand-neutral.
FUND_CATEGORIES = [
    {
        "category_name": "Large-cap index fund",
        "instrument_label": "Large-cap index mutual fund",
        "asset_type": "Mutual fund",
        "keywords": ["nifty 50 index", "nifty fifty index", "large cap index"],
        "summary_lead": "AMFI confirms wide availability of large-cap index funds. Compare expense ratio (target under 0.3%) and tracking error across AMCs before picking one.",
        "suitability": "Suitable as a core long-term equity holding (7+ years). Useful for beginners who do not want individual stock selection.",
        "risks": "Equity NAV can fall during market corrections; use SIPs and avoid money needed soon.",
    },
    {
        "category_name": "Liquid fund",
        "instrument_label": "Liquid mutual fund",
        "asset_type": "Debt mutual fund",
        "keywords": ["liquid fund", "liquid plan", "liquid scheme"],
        "summary_lead": "AMFI confirms a wide range of liquid funds. Compare AUM, credit-quality breakdown, and expense ratio across AMCs before picking.",
        "suitability": "Useful for emergency money or near-term parking — higher post-tax returns than a savings account, with same-day to T+1 redemption.",
        "risks": "Liquid funds are not bank deposits. Stress events can briefly affect NAVs. Verify scheme portfolio quality and exit rules.",
    },
    {
        "category_name": "Overnight fund",
        "instrument_label": "Overnight debt fund",
        "asset_type": "Debt mutual fund",
        "keywords": ["overnight fund"],
        "summary_lead": "AMFI confirms availability of overnight funds for ultra-short-term parking.",
        "suitability": "Suitable for money needed within days to weeks. Lowest-risk end of the debt spectrum.",
        "risks": "Minimal credit/rate risk but correspondingly low returns.",
    },
    {
        "category_name": "Short-duration debt fund",
        "instrument_label": "Short-duration debt fund",
        "asset_type": "Debt mutual fund",
        "keywords": ["short duration fund", "short term fund", "low duration fund"],
        "summary_lead": "AMFI lists multiple short-duration debt funds suitable for 1-3 year goals.",
        "suitability": "Useful for goals 1-3 years out where equity volatility is too high but liquid fund yields are too low.",
        "risks": "Interest-rate moves affect NAV. Check credit quality of the portfolio before investing.",
    },
    {
        "category_name": "Flexi-cap fund",
        "instrument_label": "Flexi-cap equity mutual fund",
        "asset_type": "Mutual fund",
        "keywords": ["flexi cap", "flexicap", "multi cap"],
        "summary_lead": "AMFI confirms a broad set of flexi-cap and multi-cap equity funds.",
        "suitability": "Suitable as a diversified core equity holding for 7+ year goals.",
        "risks": "Equity drawdowns can be sharp. Fund manager skill and consistency matter — verify long-term track record.",
    },
    {
        "category_name": "Mid-cap fund",
        "instrument_label": "Mid-cap equity mutual fund",
        "asset_type": "Mutual fund",
        "keywords": ["mid cap fund", "midcap fund"],
        "summary_lead": "AMFI lists mid-cap equity funds across AMCs.",
        "suitability": "Suitable for 10+ year goals when adding growth tilt on top of a core large-cap holding.",
        "risks": "Mid-caps can fall sharply during bear markets. Not for short-term goals.",
    },
    {
        "category_name": "Small-cap fund",
        "instrument_label": "Small-cap equity mutual fund",
        "asset_type": "Mutual fund",
        "keywords": ["small cap fund", "smallcap fund"],
        "summary_lead": "AMFI lists small-cap equity funds suitable only for very long horizons.",
        "suitability": "Suitable only as a small portion of long-term equity (10+ years) for high-risk-tolerance investors.",
        "risks": "Small-caps can fall 40-60% in bear markets and take years to recover.",
    },
    {
        "category_name": "ELSS / tax-saving fund",
        "instrument_label": "ELSS tax-saving equity fund",
        "asset_type": "Mutual fund",
        "keywords": ["elss", "tax saver", "tax saving"],
        "summary_lead": "AMFI lists ELSS funds eligible for Section 80C deduction (up to Rs 1.5L/year under old regime).",
        "suitability": "Suitable for users in the old tax regime who want equity exposure with tax benefit. Three-year lock-in.",
        "risks": "Equity drawdowns can occur during the lock-in. Verify expense ratio and consistency.",
    },
    {
        "category_name": "Hybrid balanced fund",
        "instrument_label": "Hybrid balanced advantage fund",
        "asset_type": "Hybrid mutual fund",
        "keywords": ["balanced advantage", "dynamic asset allocation", "aggressive hybrid"],
        "summary_lead": "AMFI lists hybrid balanced-advantage funds that mix equity and debt dynamically.",
        "suitability": "Suitable for investors who want lower volatility than pure equity for 3-5 year goals.",
        "risks": "Equity component still falls in market corrections; rebalancing rules vary by AMC.",
    },
    {
        "category_name": "Gilt fund",
        "instrument_label": "Gilt (government bond) fund",
        "asset_type": "Debt mutual fund",
        "keywords": ["gilt"],
        "summary_lead": "AMFI lists gilt funds that invest in government securities (sovereign-credit, no default risk).",
        "suitability": "Suitable for 3-5 year goals where you want sovereign-credit bonds and can tolerate interest-rate swings.",
        "risks": "NAV falls when interest rates rise (duration risk); returns vary with the rate cycle.",
    },
    {
        "category_name": "Corporate bond fund",
        "instrument_label": "Corporate bond fund",
        "asset_type": "Debt mutual fund",
        "keywords": ["corporate bond"],
        "summary_lead": "AMFI lists corporate bond funds investing mostly in high-rated (AA+/AAA) company bonds.",
        "suitability": "Suitable for 2-4 year goals wanting slightly higher yield than gilts with mostly high-grade credit.",
        "risks": "Credit-quality and interest-rate risk; verify the portfolio's rating profile.",
    },
    {
        "category_name": "Banking & PSU fund",
        "instrument_label": "Banking & PSU debt fund",
        "asset_type": "Debt mutual fund",
        "keywords": ["banking", "psu"],
        "summary_lead": "AMFI lists Banking & PSU debt funds investing in bonds of banks and public-sector entities.",
        "suitability": "Suitable for 2-4 year goals wanting relatively high credit quality with moderate duration.",
        "risks": "Interest-rate and (limited) credit risk; returns vary with the rate cycle.",
    },
    {
        "category_name": "Arbitrage fund",
        "instrument_label": "Arbitrage fund",
        "asset_type": "Debt mutual fund",
        "keywords": ["arbitrage"],
        "summary_lead": "AMFI lists arbitrage funds that earn from cash-futures spreads with low directional risk (equity taxation).",
        "suitability": "Suitable as a low-risk parking option for 6-18 months, often more tax-efficient than debt funds for high earners.",
        "risks": "Returns depend on spreads and can be low in calm markets; not a guaranteed product.",
    },
]


# Maps each category to a fund_picker spec so the generic label can be
# replaced with a specific, return-ranked scheme.
_PICKER_KEYS = {
    "Large-cap index fund": "large_cap_index",
    "Liquid fund": "liquid",
    "Overnight fund": "overnight",
    "Short-duration debt fund": "short_duration",
    "Flexi-cap fund": "flexi_cap",
    "Mid-cap fund": "mid_cap",
    "Small-cap fund": "small_cap",
    "ELSS / tax-saving fund": "elss",
    "Hybrid balanced fund": "hybrid",
    "Gilt fund": "gilt",
    "Corporate bond fund": "corporate_bond",
    "Banking & PSU fund": "banking_psu",
    "Arbitrage fund": "arbitrage",
}


def category_key_for_name(category_name: str) -> str | None:
    """Map a human category name (e.g. 'Flexi-cap fund') to a factor-engine key."""
    return _PICKER_KEYS.get(category_name)


def _perf_clause(fund: dict) -> str:
    bits = []
    for label, key in (("1Y", "return1y"), ("3Y", "return3y"), ("5Y", "return5y")):
        val = fund.get(key)
        if isinstance(val, (int, float)):
            bits.append(f"{label} {val:.1f}%")
    return ", ".join(bits) if bits else "returns unavailable"


def _factor_clause(fund: dict) -> str:
    """Risk-adjusted highlights for the summary (the analyst-grade angle)."""
    bits = []
    if fund.get("sortino") is not None:
        bits.append(f"Sortino {fund['sortino']}")
    if fund.get("maxDrawdown") is not None:
        bits.append(f"worst drawdown {fund['maxDrawdown']}%")
    if fund.get("downCapture") is not None:
        bits.append(f"down-capture {fund['downCapture']}")
    if fund.get("alpha") is not None:
        bits.append(f"alpha {fund['alpha']}% vs Nifty 50")
    return ", ".join(bits)


def _fund_entry(fund: dict, score: int | None = None) -> dict:
    """Display + factor payload for a fund in an asset's specificFunds list."""
    long_ret = next((fund.get(k) for k in ("cagr5y", "cagr3y", "cagr1y") if fund.get(k) is not None), None)
    basis = "5Y" if fund.get("cagr5y") is not None else "3Y" if fund.get("cagr3y") is not None else "1Y"
    return {
        "name": fund["name"],
        "fundHouse": fund.get("fundHouse", ""),
        "schemeCode": fund["schemeCode"],
        "plan": fund.get("plan", "Direct - Growth"),
        "latestNav": fund.get("latestNav", 0.0),
        "navDate": fund.get("navDate", ""),
        "return1y": fund.get("cagr1y"),
        "return3y": fund.get("cagr3y"),
        "return5y": fund.get("cagr5y"),
        "rankReturn": long_ret,
        "rankBasis": basis,
        "sharpe": fund.get("sharpe"),
        "sortino": fund.get("sortino"),
        "calmar": fund.get("calmar"),
        "maxDrawdown": fund.get("maxDrawdown"),
        "downCapture": fund.get("downCapture"),
        "alpha": fund.get("alpha"),
        "volatility": fund.get("volatility"),
        "compositeScore": score,
    }


# The chosen fund's own factor inputs that drive its forward return estimate
# (read by ``fund_factor_service.expected_return_from_factors``). Persisted with the
# Discover card so the per-fund estimate can be recomputed at read time.
_RETURN_FACTOR_KEYS = ("cagr5y", "cagr3y", "cagrSinceInception", "volatility", "historyYears")


def _return_factors(fund: dict) -> dict:
    return {key: fund[key] for key in _RETURN_FACTOR_KEYS if fund.get(key) is not None}


def _fetch_text(url: str, timeout: int = 10) -> tuple[str, str]:
    result = fetch_text(url, timeout=timeout, retries=2, cache_ttl_seconds=24 * 3600)
    return result.text, result.mode


def fetch_amfi_nav_text() -> tuple[str, str, str]:
    for url in AMFI_NAV_URLS:
        text, mode = _fetch_text(url)
        if text:
            return text, mode, url
    return "", "limited", AMFI_NAV_URLS[0]


def parse_amfi_nav(text: str, source_url: str, data_mode: str) -> list[dict]:
    """Emit specific, factor-ranked fund picks per category (with AMFI evidence).

    Selection ranks the category's Direct+Growth pool on a *risk-adjusted* factor
    composite (Sortino/Calmar/drawdown/down-capture/consistency), not trailing
    CAGR. The chosen funds carry their full factor bundle so the recommendation
    engine can re-rank them per the user's profile/goal at request time.
    """
    from app.services.research.fund_factor_service import (
        category_candidates,
        category_percentiles,
        score_fund,
    )

    timestamp = now_iso()
    assets: list[dict] = []
    lines = [line.strip() for line in text.splitlines() if ";" in line]
    for category in FUND_CATEGORIES:
        matches: list[list[str]] = []
        for line in lines:
            lower = line.lower()
            if any(keyword in lower for keyword in category["keywords"]):
                parts = line.split(";")
                if len(parts) >= 6:
                    matches.append(parts)
                if len(matches) >= 8:
                    break
        if not matches:
            continue

        # Resolve the category to specific schemes ranked on risk-adjusted factors.
        picker_key = _PICKER_KEYS.get(category["category_name"])
        candidates = category_candidates(picker_key, amfi_text=text) if picker_key else []
        ranked: list[dict] = []
        return_factors: dict = {}
        if candidates:
            pcts = category_percentiles(candidates)
            scored = [(score_fund(c, pcts.get(c["schemeCode"], {}))["score"], c) for c in candidates]
            scored.sort(key=lambda item: item[0], reverse=True)
            ranked = [_fund_entry(c, score=s) for s, c in scored[:3]]
            return_factors = _return_factors(scored[0][1]) if scored else {}

        if ranked:
            top = ranked[0]
            instrument_name = f"{top['name']} ({top['plan']})"
            alternatives = [p["name"] for p in ranked[1:]]
            alt_clause = f" Other strong options: {'; '.join(alternatives)}." if alternatives else ""
            factor_clause = _factor_clause(top)
            factor_text = f" Risk-adjusted profile: {factor_clause}." if factor_clause else ""
            summary = (
                f"{top['name']} is a specific {category['category_name'].lower()} chosen by ranking "
                f"Direct-plan funds on risk-adjusted quality, not just trailing return.{factor_text} "
                f"Trailing returns (net of expenses): {_perf_clause(top)}.{alt_clause} {category['summary_lead']}"
            )
            evidence = [
                {
                    "sourceName": "AMFI India",
                    "sourceUrl": source_url,
                    "dataMode": data_mode,
                    "scheme": pick["name"],
                    "nav": str(pick.get("latestNav", "")),
                    "navDate": pick.get("navDate", ""),
                    "returns": _perf_clause(pick),
                }
                for pick in ranked
            ]
            confidence = 86 if data_mode == "live" else 58
        else:
            instrument_name = category["instrument_label"]
            summary = f"{category['summary_lead']} {len(matches)} matching schemes are available in AMFI's latest NAV file."
            evidence = [
                {
                    "sourceName": "AMFI India",
                    "sourceUrl": source_url,
                    "dataMode": data_mode,
                    "scheme": parts[3].strip(),
                    "nav": parts[4].strip(),
                    "navDate": parts[5].strip() if len(parts) > 5 else "",
                }
                for parts in matches[:3]
            ]
            confidence = 82 if data_mode == "live" else 55

        assets.append(
            {
                "instrumentName": instrument_name,
                "assetType": category["asset_type"],
                "category": category["category_name"],
                "summary": summary,
                "suitabilityNotes": category["suitability"],
                "riskNotes": category["risks"],
                "evidence": evidence,
                "dataMode": data_mode,
                "confidenceScore": confidence,
                "retrievedAt": timestamp,
                "specificFunds": ranked,
                "returnFactors": return_factors,
            }
        )
    return assets


def fetch_fund_research() -> tuple[list[dict], str, str]:
    text, mode, url = fetch_amfi_nav_text()
    if not text:
        return [], "limited", "AMFI NAV fetch failed; no fund category research generated."
    assets = parse_amfi_nav(text, url, mode)
    if not assets:
        return [], mode, "AMFI NAV fetched but no fund categories matched; no research generated."
    return assets, mode, f"Fetched AMFI NAV data and matched {len(assets)} fund categories."


def amfi_assets_to_signals(assets: list[dict]) -> list[dict]:
    signals = []
    for asset in assets:
        if asset["dataMode"] == "fallback":
            continue
        evidence = asset["evidence"][0]
        signals.append(
            {
                "title": asset["instrumentName"],
                "summary": asset["summary"],
                "signalType": "fund category insight",
                "sentiment": "neutral",
                "assetClasses": ["mutual fund", "debt"] if "Debt" in asset["assetType"] else ["mutual fund", "equity"],
                "instruments": [asset["instrumentName"]],
                "sectors": ["debt funds"] if "Debt" in asset["assetType"] else ["broad market"],
                "macroThemes": [],
                "riskSignals": ["NAV data confirms category availability, not future returns"],
                "opportunitySignals": [f"{len(asset['evidence'])} matching schemes in AMFI"],
                "relevanceScore": 80,
                "credibilityScore": 95,
                "confidenceScore": asset["confidenceScore"],
                "sourceName": "AMFI India",
                "sourceUrl": evidence["sourceUrl"],
                "publishedAt": evidence.get("navDate", ""),
                "retrievedAt": asset["retrievedAt"],
                "dataMode": asset["dataMode"],
            }
        )
    return signals
