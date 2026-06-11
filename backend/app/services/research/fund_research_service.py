"""Fund research ingestion from AMFI.

Previously this module pinned research output to four hardcoded scheme
names (e.g. "UTI Nifty 50 Index Fund", "SBI Liquid Fund"). That meant
every profile saw the same specific AMC product as a recommendation,
regardless of what AMFI actually had on file. This rewrite produces
**category-level candidates** ("Large-cap index mutual fund", "Liquid
fund", etc.) and uses real AMFI scheme matches as supporting evidence.
Specific scheme selection is delegated to the user/advisor — the engine
no longer brands recommendations with a particular AMC.
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
]


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
    """Emit category-level fund candidates with real AMFI evidence attached."""
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
        # Take up to 3 matched schemes as evidence — proof the category is
        # populated today, without pinning the recommendation to a specific AMC.
        evidence: list[dict] = []
        for parts in matches[:3]:
            scheme_name = parts[3].strip()
            nav = parts[4].strip()
            nav_date = parts[5].strip() if len(parts) > 5 else ""
            evidence.append(
                {
                    "sourceName": "AMFI India",
                    "sourceUrl": source_url,
                    "dataMode": data_mode,
                    "scheme": scheme_name,
                    "nav": nav,
                    "navDate": nav_date,
                }
            )
        assets.append(
            {
                "instrumentName": category["instrument_label"],
                "assetType": category["asset_type"],
                "category": category["category_name"],
                "summary": f"{category['summary_lead']} {len(matches)} matching schemes are available in AMFI's latest NAV file.",
                "suitabilityNotes": category["suitability"],
                "riskNotes": category["risks"],
                "evidence": evidence,
                "dataMode": data_mode,
                "confidenceScore": 82 if data_mode == "live" else 55,
                "retrievedAt": timestamp,
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
