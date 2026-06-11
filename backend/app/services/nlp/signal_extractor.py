from __future__ import annotations

from app.services.intelligence import now_iso
from app.services.nlp.financial_entity_extractor import extract_financial_entities
from app.services.nlp.sentiment_analyzer import analyze_sentiment
from app.services.nlp.thesis_summarizer import summarize_thesis


def extract_signal_from_article(article: dict) -> dict:
    text = " ".join([article.get("title", ""), article.get("summary", ""), article.get("rawText", "")])
    entities = extract_financial_entities(text)
    sentiment = analyze_sentiment(text)
    thesis = summarize_thesis(article.get("title", ""), article.get("summary", ""), entities, sentiment)
    signal_type = _signal_type(text, entities)
    credibility = int(article.get("credibilityScore", 50))
    relevance = _relevance_score(entities)
    sentiment_confidence = sentiment.get("confidence", 50)
    confidence = max(20, min(95, round(credibility * 0.4 + relevance * 0.35 + sentiment_confidence * 0.25)))
    return {
        "title": thesis["headline"],
        "summary": thesis["conciseThesis"],
        "signalType": signal_type,
        "sentiment": sentiment["sentiment"],
        "assetClasses": entities["assetClasses"],
        "instruments": entities["companies"] + entities["tickers"] + entities["cryptoAssets"],
        "sectors": entities["sectors"],
        "macroThemes": entities["macroEvents"] + entities["policyEvents"] + entities["geopoliticalEvents"],
        "riskSignals": _risk_signals(text, sentiment),
        "opportunitySignals": _opportunity_signals(text, sentiment, entities),
        "relevanceScore": relevance,
        "credibilityScore": credibility,
        "confidenceScore": confidence,
        "sourceName": article.get("sourceName", "Unknown source"),
        "sourceUrl": article.get("sourceUrl", ""),
        "publishedAt": article.get("publishedAt", ""),
        "retrievedAt": article.get("retrievedAt", now_iso()),
        "dataMode": article.get("extractionMode", article.get("dataMode", "limited")),
        "entities": entities,
        "whyItMatters": thesis["whyItMatters"],
    }


def _signal_type(text: str, entities: dict) -> str:
    lower = text.lower()
    if entities.get("geopoliticalEvents"):
        return "geopolitical"
    if entities.get("policyEvents"):
        return "policy"
    if entities.get("macroEvents"):
        return "macro"
    if entities.get("cryptoAssets") or "crypto" in lower:
        return "crypto"
    if any(term in lower for term in ["earnings", "profit", "revenue", "margin"]):
        return "fundamental"
    if any(term in lower for term in ["breakout", "support", "resistance", "moving average", "volume"]):
        return "technical"
    if entities.get("sectors"):
        return "sector"
    return "sentiment"


def _relevance_score(entities: dict) -> int:
    score = 35
    score += min(20, len(entities.get("assetClasses", [])) * 5)
    score += min(20, len(entities.get("sectors", [])) * 5)
    score += min(20, len(entities.get("companies", [])) * 5)
    score += min(15, len(entities.get("macroEvents", [])) * 5)
    return max(20, min(95, score))


def _risk_signals(text: str, sentiment: dict) -> list[str]:
    lower = text.lower()
    risks = []
    for term, label in [
        ("volatility", "volatility risk"),
        ("war", "geopolitical risk"),
        ("inflation", "inflation risk"),
        ("rate hike", "rate risk"),
        ("oil", "commodity price risk"),
        ("outflow", "foreign flow risk"),
        ("downgrade", "earnings or rating downgrade risk"),
    ]:
        if term in lower:
            risks.append(label)
    if sentiment.get("sentiment") in {"bearish", "mixed"}:
        risks.append("sentiment risk")
    return sorted(set(risks))[:6]


def _opportunity_signals(text: str, sentiment: dict, entities: dict) -> list[str]:
    lower = text.lower()
    opportunities = []
    for term, label in [
        ("rate cut", "rate-sensitive opportunity"),
        ("capex", "capital expenditure tailwind"),
        ("budget", "policy-linked opportunity"),
        ("breakout", "technical breakout"),
        ("inflow", "liquidity support"),
        ("upgrade", "earnings or analyst upgrade"),
        ("growth", "growth momentum"),
    ]:
        if term in lower:
            opportunities.append(label)
    if sentiment.get("sentiment") == "bullish":
        opportunities.append("positive sentiment")
    if entities.get("sectors"):
        opportunities.append("sector-linked signal")
    return sorted(set(opportunities))[:6]
