from __future__ import annotations

import re
from typing import Any


ASSET_CLASS_LABELS = {
    "mutual fund": "Mutual Funds",
    "index fund": "Mutual Funds",
    "liquid fund": "Debt Funds",
    "debt mutual fund": "Debt Funds",
    "debt": "Debt Funds",
    "bond": "Bonds",
    "etf": "ETFs",
    "gold": "Commodities",
    "commodity": "Commodities",
    "crypto": "Crypto",
    "cash": "Cash / Liquid",
    "reit": "REITs / InvITs",
    "invit": "REITs / InvITs",
    "international": "International Equity",
    "stock": "Stocks / Equities",
    "equity": "Stocks / Equities",
    "share": "Stocks / Equities",
    "large-cap": "Stocks / Equities",
    "mid-cap": "Stocks / Equities",
    "bank": "Stocks / Equities",
    "leader": "Stocks / Equities",
}

SECTOR_TERMS = {
    "Banking": ["bank", "banking", "nbfc", "credit", "lending"],
    "IT": ["it services", "technology spending", "software", "export-oriented it", "infosys", "tcs"],
    "Auto": ["auto", "autos", "vehicle", "ev", "maruti", "tata motors"],
    "Cement": ["cement", "ultratech"],
    "Defence": ["defence", "aerospace", "shipbuilding", "electronics", "bel", "hal"],
    "Infrastructure": ["infrastructure", "capital goods", "capex", "construction", "larsen", "siemens"],
    "Energy": ["energy", "oil", "crude", "upstream", "ongc", "reliance"],
    "Pharma": ["pharma", "pharmaceutical", "healthcare"],
    "Consumption": ["consumption", "consumer", "retail", "discretionary"],
    "Real Estate": ["real estate", "property", "housing", "dlf"],
    "Crypto Infrastructure": ["crypto", "bitcoin", "ethereum", "solana", "chainlink", "defi", "tokenized"],
    "Gold / Precious Metals": ["gold", "precious metal", "bullion"],
}

CRYPTO_TERMS = {"bitcoin", "ethereum", "solana", "chainlink", "coingecko", "crypto", "btc", "eth", "sol", "link"}
RAW_DATA_TERMS = ("nav record", "latest nav", "coingecko", "simple price data", "yahoo", "chart returned", "api record")


def normalize_asset_class(asset_type: str, category: str = "") -> str:
    text = f"{asset_type} {category}".lower()
    for term, label in ASSET_CLASS_LABELS.items():
        if term in text:
            return label
    return "Other"


def infer_sector_theme(asset_name: str, asset_type: str = "", category: str = "", fallback: str = "Diversified") -> str:
    text = f"{asset_name} {asset_type} {category}".lower()
    for label, terms in SECTOR_TERMS.items():
        if any(_contains_term(text, term) for term in terms):
            return label
    return fallback


def filter_relevant_evidence(asset: dict[str, Any], evidence: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    scored = [score_evidence_relevance(asset, item) for item in evidence or []]
    relevant = [item for item in scored if item["relationship_type"] != "unrelated" and item["relevance_score"] >= 45]
    relevant.sort(key=lambda item: item["relevance_score"], reverse=True)
    return _dedupe(relevant)


def score_evidence_relevance(asset: dict[str, Any], evidence: dict[str, Any]) -> dict[str, Any]:
    asset_name = str(asset.get("assetName") or asset.get("instrumentName") or asset.get("name") or "")
    ticker = str(asset.get("ticker") or asset.get("symbol") or "").replace(".NS", "")
    asset_class = normalize_asset_class(str(asset.get("assetType") or asset.get("assetClass") or ""), str(asset.get("category") or ""))
    sector = str(asset.get("sectorTheme") or infer_sector_theme(asset_name, str(asset.get("assetType", "")), str(asset.get("category", ""))))
    summary = str(evidence.get("summary") or "")
    source = str(evidence.get("sourceName") or evidence.get("source") or "")
    url = str(evidence.get("sourceUrl") or evidence.get("url") or "")
    signal_type = str(evidence.get("signalType") or "").lower()
    haystack = f"{summary} {source} {url} {signal_type}".lower()

    if asset_class != "Crypto" and any(_contains_term(haystack, term) for term in CRYPTO_TERMS):
        return {**evidence, "relevance_score": 0, "relationship_type": "unrelated"}

    if asset_name and _contains_phrase(haystack, asset_name):
        return {**evidence, "relevance_score": 95, "relationship_type": "direct_asset"}
    if ticker and _contains_term(haystack, ticker):
        return {**evidence, "relevance_score": 92, "relationship_type": "direct_asset"}

    if asset_class in {"Mutual Funds", "Debt Funds"} and "amfi" in haystack:
        return {**evidence, "relevance_score": 82, "relationship_type": "asset_class_related"}
    if asset_class == "ETFs" and ("nse" in haystack or "etf" in haystack):
        return {**evidence, "relevance_score": 76, "relationship_type": "asset_class_related"}
    if asset_class == "Crypto" and any(_contains_term(haystack, term) for term in CRYPTO_TERMS):
        return {**evidence, "relevance_score": 82, "relationship_type": "asset_class_related"}
    if asset_class == "Commodities" and any(_contains_term(haystack, term) for term in ["gold", "commodity", "rbi"]):
        return {**evidence, "relevance_score": 74, "relationship_type": "asset_class_related"}

    sector_terms = SECTOR_TERMS.get(sector, [])
    if sector_terms and any(_contains_term(haystack, term) for term in sector_terms):
        return {**evidence, "relevance_score": 68, "relationship_type": "sector_related"}

    if signal_type in {"macro", "policy", "geopolitical", "currency", "commodity"} and sector_terms and any(_contains_term(haystack, term) for term in sector_terms):
        return {**evidence, "relevance_score": 58, "relationship_type": "macro_related"}

    return {**evidence, "relevance_score": 0, "relationship_type": "unrelated"}


def is_raw_data_text(text: str) -> bool:
    value = str(text or "").lower()
    return any(term in value for term in RAW_DATA_TERMS)


def _dedupe(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    result = []
    for item in items:
        key = (
            str(item.get("sourceUrl", "")),
            str(item.get("sourceName", "")),
            str(item.get("summary", ""))[:100],
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _contains_phrase(text: str, phrase: str) -> bool:
    normalized = re.sub(r"[^a-z0-9]+", " ", phrase.lower()).strip()
    if not normalized:
        return False
    return normalized in re.sub(r"[^a-z0-9]+", " ", text.lower())


def _contains_term(text: str, term: str) -> bool:
    value = term.lower().strip()
    if not value:
        return False
    if len(value) <= 3:
        return bool(re.search(rf"(?<![a-z0-9]){re.escape(value)}(?![a-z0-9])", text.lower()))
    return value in text.lower()
