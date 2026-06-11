from __future__ import annotations

from app.agents.geopolitical_interpreter_agent import interpret_geopolitical_signal
from app.agents.macro_interpreter_agent import interpret_macro_signal
from app.agents.policy_impact_agent import interpret_policy_signal


VALID_SIGNAL_TYPES = {
    "macro",
    "geopolitical",
    "policy",
    "sector",
    "technical",
    "fundamental",
    "sentiment",
    "crypto",
    "commodity",
    "currency",
    "earnings",
    "risk warning",
}


def classify_signal(signal: dict) -> str:
    text = _text(signal)
    raw_type = signal.get("signalType", "").lower().replace("_", " ")
    if raw_type in VALID_SIGNAL_TYPES:
        return raw_type
    if "risk warning" in raw_type:
        return "risk warning"
    if any(term in text for term in ["crypto", "bitcoin", "ethereum", "btc", "eth"]):
        return "crypto"
    if any(term in text for term in ["war", "geopolitical", "sanction", "border", "red sea", "strait"]):
        return "geopolitical"
    if any(term in text for term in ["sebi", "budget", "policy", "tax", "capex", "infrastructure"]):
        return "policy"
    if any(term in text for term in ["rbi", "repo", "rate", "liquidity", "inflation", "yield", "gdp"]):
        return "macro"
    if any(term in text for term in ["gold", "silver", "crude", "oil", "commodity"]):
        return "commodity"
    if any(term in text for term in ["rupee", "currency", "dollar", "forex"]):
        return "currency"
    if any(term in text for term in ["earnings", "profit", "revenue", "margin", "dividend"]):
        return "earnings"
    if any(term in text for term in ["breakout", "support", "resistance", "moving average", "trend", "volume"]):
        return "technical"
    if any(term in text for term in ["fundamental", "roe", "roce", "valuation"]):
        return "fundamental"
    if signal.get("sectors"):
        return "sector"
    return "sentiment"


def build_signal_impact(signal: dict, evidence_links: list[dict] | None = None, contradiction_links: list[dict] | None = None, related_recommendations: list[str] | None = None) -> dict:
    classification = classify_signal(signal)
    sectors = set(signal.get("sectors", []))
    asset_classes = set(signal.get("assetClasses", []))
    instruments = set(signal.get("instruments", []))
    beneficiaries: set[str] = set(sectors)
    losers: set[str] = set()
    risks: set[str] = set(signal.get("riskSignals", []))
    drivers: list[str] = []

    interpreters = []
    if classification in {"macro", "currency", "commodity"}:
        interpreters.append(interpret_macro_signal(signal))
    if classification in {"geopolitical", "commodity"}:
        interpreters.append(interpret_geopolitical_signal(signal))
    if classification == "policy":
        interpreters.append(interpret_policy_signal(signal))
    if classification == "sector":
        interpreters.append(_sector_impact(signal))
    if classification in {"technical", "risk warning"}:
        interpreters.append(_technical_impact(signal))
    if classification in {"fundamental", "earnings"}:
        interpreters.append(_fundamental_impact(signal))
    if classification == "crypto":
        interpreters.append(_crypto_impact(signal))

    short_terms = []
    long_terms = []
    for interpreted in interpreters:
        beneficiaries.update(interpreted.get("beneficiaries", []))
        losers.update(interpreted.get("losers", []))
        risks.update(interpreted.get("risks", []))
        drivers.extend(interpreted.get("drivers", []))
        if interpreted.get("shortTermImpact"):
            short_terms.append(interpreted["shortTermImpact"])
        if interpreted.get("longTermImpact"):
            long_terms.append(interpreted["longTermImpact"])

    if classification == "commodity" and "gold" in _text(signal):
        beneficiaries.add("gold")
        asset_classes.add("gold")
    if classification == "crypto":
        asset_classes.add("crypto")

    confidence = _impact_confidence(signal, evidence_links or [], contradiction_links or [])
    relevance = min(95, max(signal.get("relevanceScore", 50), confidence - 5))
    return {
        "signalClassification": classification,
        "affectedSectors": sorted(beneficiaries | sectors)[:10],
        "affectedAssetClasses": sorted(asset_classes)[:8],
        "likelyBeneficiaries": sorted(beneficiaries)[:10],
        "likelyLosers": sorted(losers)[:8],
        "relevantInstruments": sorted(instruments | _instruments_from_rules(beneficiaries, asset_classes))[:12],
        "shortTermImpact": short_terms[0] if short_terms else _default_short_term(classification),
        "longTermImpact": long_terms[0] if long_terms else _default_long_term(classification),
        "confidenceScore": confidence,
        "portfolioRelevance": relevance,
        "goalRelevance": _goal_relevance(classification, signal),
        "risks": sorted(risks)[:8],
        "drivers": drivers[:5] or [f"{classification} signal"],
        "evidenceLinks": evidence_links or [],
        "contradictionLinks": contradiction_links or [],
        "relatedRecommendations": related_recommendations or [],
    }


def _signal_weight(signal: dict) -> int:
    sentiment = signal.get("sentiment", "neutral")
    if sentiment == "bullish":
        return 1
    if sentiment == "bearish":
        return -1
    return 0


def _sector_impact(signal: dict) -> dict:
    direction = _signal_weight(signal)
    return {
        "beneficiaries": signal.get("sectors", []) if direction >= 0 else [],
        "losers": signal.get("sectors", []) if direction < 0 else [],
        "risks": ["sector rotation can reverse"] if signal.get("sectors") else [],
        "drivers": ["sector rotation signal"],
        "shortTermImpact": "Sector sentiment may affect tactical entries and position sizing.",
        "longTermImpact": "Persistent sector strength can support satellite allocations, but avoid concentration.",
    }


def _technical_impact(signal: dict) -> dict:
    bearish = signal.get("sentiment") == "bearish" or signal.get("signalType") == "risk warning"
    return {
        "beneficiaries": [] if bearish else signal.get("instruments", []),
        "losers": signal.get("instruments", []) if bearish else [],
        "risks": ["technical signal can reverse quickly", "avoid using price trend alone"],
        "drivers": ["price/technical signal"],
        "shortTermImpact": "Technical evidence mainly affects entry timing and review cadence.",
        "longTermImpact": "Long-term suitability still depends on fundamentals, risk profile, and goal timeline.",
    }


def _fundamental_impact(signal: dict) -> dict:
    positive = signal.get("sentiment") == "bullish"
    negative = signal.get("sentiment") == "bearish"
    return {
        "beneficiaries": signal.get("instruments", []) if positive else signal.get("sectors", []),
        "losers": signal.get("instruments", []) if negative else [],
        "risks": ["earnings can be one-off", "valuation may already reflect good news"],
        "drivers": ["earnings/fundamental signal"],
        "shortTermImpact": "Fundamental news can change near-term sentiment around an asset or sector.",
        "longTermImpact": "Repeated earnings quality is more important than one headline.",
    }


def _crypto_impact(signal: dict) -> dict:
    return {
        "beneficiaries": signal.get("instruments", []) or ["BTC", "ETH"],
        "losers": [],
        "risks": ["extreme volatility", "regulatory risk", "liquidity stress"],
        "drivers": ["crypto market signal"],
        "shortTermImpact": "Crypto signals should affect only watchlist or capped tactical exposure.",
        "longTermImpact": "Crypto allocation remains optional and should not fund essential goals.",
    }


def _impact_confidence(signal: dict, evidence_links: list[dict], contradiction_links: list[dict]) -> int:
    base = signal.get("confidenceScore", 50)
    evidence_bonus = min(10, len({item.get("sourceUrl") or item.get("sourceName") for item in evidence_links}) * 3)
    contradiction_penalty = min(18, len(contradiction_links) * 6)
    return max(20, min(95, base + evidence_bonus - contradiction_penalty))


def _goal_relevance(classification: str, signal: dict) -> int:
    if classification in {"risk warning", "macro", "policy"}:
        return min(95, signal.get("relevanceScore", 50) + 12)
    if classification in {"technical", "crypto"}:
        return max(30, signal.get("relevanceScore", 50) - 5)
    return signal.get("relevanceScore", 50)


def _instruments_from_rules(beneficiaries: set[str], asset_classes: set[str]) -> set[str]:
    instruments: set[str] = set()
    if "banks" in beneficiaries or "banking" in beneficiaries or "NBFCs" in beneficiaries:
        instruments.update(["Nifty Bank ETF", "HDFC Bank", "ICICI Bank"])
    if "capital goods" in beneficiaries or "infrastructure" in beneficiaries:
        instruments.update(["Larsen & Toubro", "capital goods funds"])
    if "gold" in beneficiaries or "gold" in asset_classes:
        instruments.update(["Gold ETF", "Sovereign Gold Bonds"])
    if "defence" in beneficiaries:
        instruments.update(["Bharat Electronics", "defence sector watchlist"])
    if "crypto" in asset_classes:
        instruments.update(["Bitcoin", "Ethereum"])
    return instruments


def _default_short_term(classification: str) -> str:
    return f"This {classification} signal may affect sentiment and near-term allocation timing."


def _default_long_term(classification: str) -> str:
    return f"Treat this {classification} signal as one evidence input, not as a standalone investment decision."


def _text(signal: dict) -> str:
    return " ".join(
        [
            signal.get("summary", ""),
            signal.get("title", ""),
            signal.get("signalType", ""),
            " ".join(signal.get("macroThemes", [])),
            " ".join(signal.get("sectors", [])),
            " ".join(signal.get("assetClasses", [])),
            " ".join(signal.get("riskSignals", [])),
            " ".join(signal.get("opportunitySignals", [])),
        ]
    ).lower()
