from __future__ import annotations

from app.services.intelligence import now_iso
from app.services.research.http_client import fetch_text


AMFI_NAV_URLS = [
    "https://portal.amfiindia.com/spages/NAVOpen.txt",
    "https://www.amfiindia.com/spages/NAVOpen.txt",
]

TARGET_FUND_KEYWORDS = [
    ("UTI Nifty 50 Index Fund", ["uti nifty 50 index fund", "uti nifty fifty index"]),
    ("HDFC Index Fund Nifty 50 Plan", ["hdfc index fund-nifty 50", "hdfc index fund nifty 50"]),
    ("SBI Liquid Fund", ["sbi liquid fund"]),
    ("ICICI Prudential Liquid Fund", ["icici prudential liquid fund"]),
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
    timestamp = now_iso()
    assets = []
    lines = [line.strip() for line in text.splitlines() if ";" in line]
    for canonical, keywords in TARGET_FUND_KEYWORDS:
        match = None
        for line in lines:
            lower = line.lower()
            if any(keyword in lower for keyword in keywords):
                parts = line.split(";")
                if len(parts) >= 6:
                    match = parts
                    break
        if not match:
            continue
        scheme_name = match[3].strip() or canonical
        nav = match[4].strip()
        nav_date = match[5].strip() if len(match) > 5 else ""
        asset_type = "Debt mutual fund" if "liquid" in scheme_name.lower() else "Mutual fund"
        category = "Liquid fund" if "liquid" in scheme_name.lower() else "Large-cap index fund"
        assets.append(
            {
                "instrumentName": canonical,
                "assetType": asset_type,
                "category": category,
                "summary": f"AMFI NAV record found for {scheme_name}. Latest NAV in file: {nav} dated {nav_date}.",
                "suitabilityNotes": "Use as a candidate only after checking expense ratio, tracking error, portfolio quality, and suitability.",
                "riskNotes": "NAV data confirms scheme availability, not future returns. Market and fund risks remain.",
                "evidence": [{"sourceName": "AMFI India", "sourceUrl": source_url, "dataMode": data_mode, "nav": nav, "navDate": nav_date}],
                "dataMode": data_mode,
                "confidenceScore": 86 if data_mode == "live" else 60,
                "retrievedAt": timestamp,
            }
        )
    return assets


def fetch_fund_research() -> tuple[list[dict], str, str]:
    text, mode, url = fetch_amfi_nav_text()
    if not text:
        return [], "limited", "AMFI NAV fetch failed; no fallback fund research was generated."
    assets = parse_amfi_nav(text, url, mode)
    if not assets:
        return [], mode, "AMFI NAV fetched but target funds were not found; no fallback fund research was generated."
    return assets, mode, f"Fetched AMFI NAV data and matched {len(assets)} target schemes."


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
                "signalType": "fund insight",
                "sentiment": "neutral",
                "assetClasses": ["mutual fund", "debt"] if "Debt" in asset["assetType"] else ["mutual fund", "equity"],
                "instruments": [asset["instrumentName"]],
                "sectors": ["debt funds"] if "Debt" in asset["assetType"] else ["broad market"],
                "macroThemes": [],
                "riskSignals": ["NAV data is not a return guarantee"],
                "opportunitySignals": ["scheme found in AMFI NAV data"],
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


def fallback_fund_research() -> list[dict]:
    timestamp = now_iso()
    return [
        {
            "instrumentName": "UTI Nifty 50 Index Fund",
            "assetType": "Mutual fund",
            "category": "Large-cap index fund",
            "summary": "Fallback candidate for broad-market long-term SIPs. Live AMFI NAV was unavailable or unmatched.",
            "suitabilityNotes": "Suitable when the user has a 7+ year horizon and wants diversified equity exposure.",
            "riskNotes": "Equity NAV can fall during market corrections. Use SIPs and avoid short-term money.",
            "evidence": [{"sourceName": "AMFI India", "sourceUrl": "https://www.amfiindia.com/", "dataMode": "fallback"}],
            "dataMode": "fallback",
            "confidenceScore": 60,
            "retrievedAt": timestamp,
        },
        {
            "instrumentName": "HDFC Index Fund Nifty 50 Plan",
            "assetType": "Mutual fund",
            "category": "Large-cap index fund",
            "summary": "Fallback candidate for simple long-term Nifty 50 allocation. Verify scheme details before investing.",
            "suitabilityNotes": "Useful as a core equity allocation for beginners who do not want stock selection.",
            "riskNotes": "Market risk remains; verify expense ratio and tracking error before investing.",
            "evidence": [{"sourceName": "AMFI India", "sourceUrl": "https://www.amfiindia.com/", "dataMode": "fallback"}],
            "dataMode": "fallback",
            "confidenceScore": 58,
            "retrievedAt": timestamp,
        },
        {
            "instrumentName": "Nippon India ETF Nifty 50 BeES",
            "assetType": "ETF",
            "category": "Nifty 50 ETF",
            "summary": "Fallback ETF candidate for exchange-traded Nifty 50 exposure.",
            "suitabilityNotes": "Suitable if user is comfortable buying ETFs through a broker and checking liquidity.",
            "riskNotes": "ETF prices can vary from NAV; brokerage account and liquidity checks are needed.",
            "evidence": [{"sourceName": "NSE India", "sourceUrl": "https://www.nseindia.com/", "dataMode": "fallback"}],
            "dataMode": "fallback",
            "confidenceScore": 58,
            "retrievedAt": timestamp,
        },
        {
            "instrumentName": "SBI Liquid Fund",
            "assetType": "Debt mutual fund",
            "category": "Liquid fund",
            "summary": "Fallback candidate for emergency or near-term money where low volatility matters.",
            "suitabilityNotes": "Useful while emergency corpus is below target.",
            "riskNotes": "Liquid funds are not bank deposits; verify portfolio quality, expense ratio, and tax treatment.",
            "evidence": [{"sourceName": "AMFI India", "sourceUrl": "https://www.amfiindia.com/", "dataMode": "fallback"}],
            "dataMode": "fallback",
            "confidenceScore": 60,
            "retrievedAt": timestamp,
        },
        {
            "instrumentName": "Sovereign Gold Bonds or low-cost Gold ETF",
            "assetType": "Gold instrument",
            "category": "Diversifier",
            "summary": "Fallback gold exposure candidate for portfolio diversification.",
            "suitabilityNotes": "Useful as a small 5-10% allocation when portfolio is equity-heavy.",
            "riskNotes": "Gold can underperform for long periods. SGB liquidity and maturity terms need review.",
            "evidence": [{"sourceName": "RBI", "sourceUrl": "https://www.rbi.org.in/", "dataMode": "fallback"}],
            "dataMode": "fallback",
            "confidenceScore": 58,
            "retrievedAt": timestamp,
        },
    ]
