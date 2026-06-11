from __future__ import annotations

import re


SECTOR_TERMS = {
    "bank": "banking",
    "banks": "banking",
    "nbfc": "NBFC",
    "real estate": "real estate",
    "auto": "auto",
    "automobile": "auto",
    "it ": "IT",
    "software": "IT",
    "pharma": "pharma",
    "defence": "defence",
    "defense": "defence",
    "capital goods": "capital goods",
    "cement": "cement",
    "steel": "steel",
    "oil": "energy",
    "energy": "energy",
    "airline": "airlines",
    "paint": "paint",
    "chemical": "chemicals",
    "logistics": "logistics",
    "consumer": "consumer",
    "fmcg": "FMCG",
    "power": "power",
    "renewable": "renewables",
}

ASSET_CLASS_TERMS = {
    "nifty": "equity",
    "sensex": "equity",
    "stock": "equity",
    "stocks": "equity",
    "shares": "equity",
    "equity": "equity",
    "mutual fund": "mutual_fund",
    "fund": "mutual_fund",
    "etf": "ETF",
    "bond": "debt",
    "debt": "debt",
    "gold": "gold",
    "silver": "silver",
    "crypto": "crypto",
    "bitcoin": "crypto",
    "ethereum": "crypto",
    "rupee": "currency",
    "dollar": "currency",
    "crude": "commodity",
    "oil": "commodity",
}

MACRO_EVENT_TERMS = {
    "rbi": "RBI policy",
    "repo rate": "rate decision",
    "rate cut": "rate cut",
    "rate hike": "rate hike",
    "inflation": "inflation",
    "fed": "US Fed stance",
    "budget": "budget policy",
    "capex": "capital expenditure",
    "gdp": "growth data",
    "liquidity": "liquidity",
    "yield": "bond yield",
}

GEOPOLITICAL_TERMS = {
    "war": "geopolitical tension",
    "sanction": "sanctions",
    "conflict": "geopolitical tension",
    "border": "border tension",
    "shipping": "shipping disruption",
    "red sea": "shipping disruption",
}

CRYPTO_TERMS = {
    "bitcoin": "BTC",
    "btc": "BTC",
    "ethereum": "ETH",
    "eth": "ETH",
    "solana": "SOL",
    "chainlink": "LINK",
}

INSTRUMENT_PATTERNS = [
    (re.compile(r"\bNifty\s?50\b", re.I), "Nifty 50"),
    (re.compile(r"\bNifty\s?Bank\b", re.I), "Nifty Bank"),
    (re.compile(r"\bSensex\b", re.I), "Sensex"),
    (re.compile(r"\bHDFC Bank\b", re.I), "HDFC Bank"),
    (re.compile(r"\bICICI Bank\b", re.I), "ICICI Bank"),
    (re.compile(r"\bReliance\b", re.I), "Reliance Industries"),
    (re.compile(r"\bInfosys\b", re.I), "Infosys"),
    (re.compile(r"\bTCS\b", re.I), "TCS"),
    (re.compile(r"\bLarsen\s*&\s*Toubro\b|\bL&T\b", re.I), "Larsen & Toubro"),
]


def extract_financial_entities(text: str) -> dict:
    normalized = f" {text.lower()} "
    sectors = _keyword_hits(normalized, SECTOR_TERMS)
    asset_classes = _keyword_hits(normalized, ASSET_CLASS_TERMS)
    macro_events = _keyword_hits(normalized, MACRO_EVENT_TERMS)
    geopolitical_events = _keyword_hits(normalized, GEOPOLITICAL_TERMS)
    crypto_assets = _keyword_hits(normalized, CRYPTO_TERMS)
    instruments = {label for pattern, label in INSTRUMENT_PATTERNS if pattern.search(text)}
    tickers = set(re.findall(r"\b[A-Z]{2,12}\.NS\b|\b[A-Z]{2,10}\.BO\b|\bBTC\b|\bETH\b", text))
    return {
        "companies": sorted(instruments),
        "tickers": sorted(tickers),
        "sectors": sorted(sectors),
        "assetClasses": sorted(asset_classes),
        "commodities": sorted({"gold", "silver", "crude oil"} & set(asset_classes | sectors)),
        "cryptoAssets": sorted(crypto_assets),
        "macroEvents": sorted(macro_events),
        "policyEvents": sorted([event for event in macro_events if "policy" in event or "budget" in event]),
        "geopoliticalEvents": sorted(geopolitical_events),
    }


def _keyword_hits(text: str, terms: dict[str, str]) -> set[str]:
    hits: set[str] = set()
    for needle, label in terms.items():
        if needle in text:
            hits.add(label)
    return hits
