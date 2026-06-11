from __future__ import annotations

from app.utils.market_headline_cleaner import clean_market_headline


def transform_market_signal(signal: dict, related_recommendations: list[str] | None = None) -> dict:
    sectors = signal.get("sectors", [])
    asset_classes = signal.get("assetClasses", [])
    macro_themes = signal.get("macroThemes", [])
    category = classify_market_signal(signal)
    beneficiaries, losers = beneficiaries_and_losers(signal.get("summary", ""), sectors, macro_themes)
    return {
        **signal,
        "title": clean_market_headline(signal.get("summary", ""), signal.get("signalType", ""), sectors, macro_themes),
        "signalCategory": category,
        "affectedAssets": asset_classes,
        "likelyBeneficiaries": beneficiaries,
        "likelyLosers": losers,
        "userRelevance": signal.get("relevanceScore", 50),
        "portfolioRelevance": min(95, round((signal.get("relevanceScore", 50) + signal.get("confidenceScore", 50)) / 2)),
        "impactScore": min(95, round(signal.get("confidenceScore", 50) * 0.45 + signal.get("credibilityScore", 50) * 0.25 + signal.get("relevanceScore", 50) * 0.3)),
        "whyItMatters": why_it_matters(category, beneficiaries, losers),
        "relatedRecommendation": ", ".join(related_recommendations or []) or signal.get("relatedRecommendation"),
    }


def classify_market_signal(signal: dict) -> str:
    text = f"{signal.get('signalType', '')} {' '.join(signal.get('macroThemes', []))} {' '.join(signal.get('sectors', []))} {signal.get('summary', '')}".lower()
    if "crypto" in text:
        return "Crypto"
    if any(term in text for term in ["war", "geopolitical", "border", "sanction"]):
        return "Geopolitical"
    if any(term in text for term in ["rbi", "rate", "repo", "inflation", "liquidity"]):
        return "Macro"
    if any(term in text for term in ["budget", "policy", "sebi", "tax"]):
        return "Policy"
    if any(term in text for term in ["earnings", "profit", "revenue", "margin"]):
        return "Earnings"
    if any(term in text for term in ["breakout", "volume", "technical", "trend"]):
        return "Technical"
    if signal.get("sectors"):
        return "Sector"
    if any(term in text for term in ["gold", "oil", "crude", "commodity"]):
        return "Commodity"
    if any(term in text for term in ["rupee", "currency", "dollar"]):
        return "Currency"
    return "Sentiment" if signal.get("signalType") == "market trend" else str(signal.get("signalType", "Sentiment")).title()


def beneficiaries_and_losers(summary: str, sectors: list[str], macro_themes: list[str]) -> tuple[list[str], list[str]]:
    text = f"{summary} {' '.join(sectors)} {' '.join(macro_themes)}".lower()
    beneficiaries = set(sectors)
    losers = set()
    if any(term in text for term in ["rate", "repo", "liquidity"]):
        beneficiaries.update(["banking", "NBFC", "real estate", "auto"])
    if any(term in text for term in ["infra", "budget", "capex"]):
        beneficiaries.update(["capital goods", "cement", "steel", "construction"])
    if any(term in text for term in ["defence", "geopolitical", "war"]):
        beneficiaries.update(["defence", "gold", "energy security"])
    if any(term in text for term in ["oil", "crude"]):
        beneficiaries.update(["upstream oil", "energy"])
        losers.update(["airlines", "paint", "chemicals", "logistics"])
    if any(term in text for term in ["rupee", "currency", "dollar"]):
        beneficiaries.update(["IT", "pharma", "exporters"])
        losers.update(["import-heavy sectors"])
    return sorted(beneficiaries)[:6], sorted(losers)[:5]


def why_it_matters(category: str, beneficiaries: list[str], losers: list[str]) -> str:
    if beneficiaries and losers:
        return f"{category} signal may support {', '.join(beneficiaries[:3])} while pressuring {', '.join(losers[:2])}."
    if beneficiaries:
        return f"{category} signal may support {', '.join(beneficiaries[:3])}; verify with earnings, valuation, and price action."
    return f"{category} signal affects portfolio risk and should be checked before changing allocation."
