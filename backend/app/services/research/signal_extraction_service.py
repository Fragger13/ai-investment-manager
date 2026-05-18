from __future__ import annotations

import re

from app.services.intelligence import now_iso


ASSET_KEYWORDS = {
    "equity": ["equity", "stock", "stocks", "nifty", "sensex", "shares", "market"],
    "mutual fund": ["mutual fund", "fund", "sip", "nav", "amfi"],
    "ETF": ["etf", "bees"],
    "debt": ["debt", "bond", "yield", "liquid fund", "gilt"],
    "gold": ["gold", "sgb", "sovereign gold"],
    "crypto": ["crypto", "bitcoin", "ethereum", "btc", "eth"],
}

SECTOR_KEYWORDS = {
    "banking": ["bank", "banking", "financial services", "nbfc"],
    "IT": ["it sector", "technology", "software", "infosys", "tcs", "wipro"],
    "energy": ["energy", "oil", "gas", "power"],
    "pharma": ["pharma", "healthcare", "drug"],
    "auto": ["auto", "vehicle", "ev", "two-wheeler"],
    "real estate": ["real estate", "housing", "property"],
    "broad market": ["nifty", "sensex", "index", "market"],
}

INSTRUMENT_KEYWORDS = {
    "UTI Nifty 50 Index Fund": ["uti nifty 50"],
    "HDFC Index Fund Nifty 50 Plan": ["hdfc index fund", "hdfc nifty 50"],
    "Nippon India ETF Nifty 50 BeES": ["niftybees", "nifty bees", "bees"],
    "SBI Liquid Fund": ["sbi liquid"],
    "ICICI Prudential Liquid Fund": ["icici prudential liquid"],
    "Sovereign Gold Bonds or low-cost Gold ETF": ["sovereign gold", "gold etf", "sgb"],
    "Bitcoin": ["bitcoin", "btc"],
    "Ethereum": ["ethereum", "eth"],
}

MACRO_KEYWORDS = {
    "inflation": ["inflation", "cpi"],
    "rates": ["rate", "repo", "yield", "bond"],
    "currency": ["rupee", "currency", "dollar", "usd"],
    "volatility": ["volatility", "volatile", "vix"],
    "liquidity": ["liquidity", "cash"],
}

BULLISH = ["gain", "gains", "rally", "rises", "up", "surge", "positive", "growth", "inflow", "record high", "bullish"]
BEARISH = ["fall", "falls", "down", "decline", "selloff", "risk", "warning", "caution", "outflow", "volatile", "uncertain", "bearish"]


def _matches(text: str, mapping: dict[str, list[str]]) -> list[str]:
    found = []
    for label, keywords in mapping.items():
        if any(keyword in text for keyword in keywords):
            found.append(label)
    return found


def classify_signal(text: str) -> tuple[str, str]:
    lower = text.lower()
    bullish_hits = sum(1 for token in BULLISH if token in lower)
    bearish_hits = sum(1 for token in BEARISH if token in lower)
    if "bitcoin" in lower or "crypto" in lower or "ethereum" in lower:
        signal_type = "crypto signal"
    elif any(token in lower for token in ["rbi", "repo", "inflation", "currency", "rupee", "yield"]):
        signal_type = "macro event"
    elif any(token in lower for token in ["fund", "etf", "sip", "nav", "amfi"]):
        signal_type = "fund insight"
    elif any(token in lower for token in ["sector", "banking", "it", "pharma", "auto", "energy"]):
        signal_type = "sector opportunity"
    elif bearish_hits > bullish_hits:
        signal_type = "risk warning"
    else:
        signal_type = "market trend"
    if bullish_hits > bearish_hits:
        sentiment = "bullish"
    elif bearish_hits > bullish_hits:
        sentiment = "bearish"
    else:
        sentiment = "neutral"
    return signal_type, sentiment


def extract_signal(article: dict, categories_hint: list[str] | None = None) -> dict:
    title = article.get("title", "Research signal")
    summary = article.get("summary", "")
    text = re.sub(r"\s+", " ", f"{title} {summary}").strip()
    lower = text.lower()
    signal_type, sentiment = classify_signal(text)
    instruments = _matches(lower, INSTRUMENT_KEYWORDS)
    asset_classes = _matches(lower, ASSET_KEYWORDS)
    sectors = _matches(lower, SECTOR_KEYWORDS)
    macro_themes = _matches(lower, MACRO_KEYWORDS)
    risk_signals = []
    if any(token in lower for token in ["volatile", "volatility", "uncertain"]):
        risk_signals.append("near-term volatility")
    if any(token in lower for token in ["rate", "yield", "repo"]):
        risk_signals.append("rate uncertainty")
    if any(token in lower for token in ["credit", "debt"]):
        risk_signals.append("credit risk needs review")
    if any(token in lower for token in ["regulation", "sebi", "crypto"]):
        risk_signals.append("regulatory risk")
    opportunity_signals = []
    if any(token in lower for token in ["sip", "long term", "long-term"]):
        opportunity_signals.append("long-term SIP relevance")
    if any(token in lower for token in ["gold", "diversification"]):
        opportunity_signals.append("diversification relevance")
    if any(token in lower for token in ["liquid", "cash", "emergency"]):
        opportunity_signals.append("liquidity buffer relevance")
    credibility = int(article.get("credibilityScore", 50))
    relevance = min(95, 45 + len(instruments) * 8 + len(asset_classes) * 6 + len(sectors) * 4 + len(macro_themes) * 3)
    if categories_hint:
        relevance = min(95, relevance + 5)
    confidence = round((credibility * 0.45) + (relevance * 0.4) + (70 * 0.15))
    mode = article.get("extractionMode", article.get("dataMode", "limited"))
    return {
        "title": title,
        "summary": summary or title,
        "signalType": signal_type,
        "sentiment": sentiment,
        "assetClasses": asset_classes or categories_hint or [],
        "instruments": instruments,
        "sectors": sectors,
        "macroThemes": macro_themes,
        "riskSignals": risk_signals,
        "opportunitySignals": opportunity_signals,
        "relevanceScore": relevance,
        "credibilityScore": credibility,
        "confidenceScore": confidence,
        "sourceName": article.get("sourceName", "Unknown source"),
        "sourceUrl": article.get("sourceUrl", ""),
        "publishedAt": article.get("publishedAt", ""),
        "retrievedAt": article.get("retrievedAt", now_iso()),
        "dataMode": mode if mode in {"live", "cached", "fallback", "limited"} else "limited",
    }
