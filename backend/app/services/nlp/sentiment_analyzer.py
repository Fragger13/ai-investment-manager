from __future__ import annotations


BULLISH_TERMS = {
    "gain",
    "rally",
    "surge",
    "growth",
    "strong",
    "beat",
    "upgrade",
    "support",
    "benefit",
    "improve",
    "cut may support",
    "breakout",
    "momentum",
    "inflow",
}

BEARISH_TERMS = {
    "fall",
    "drop",
    "pressure",
    "weak",
    "downgrade",
    "miss",
    "risk",
    "concern",
    "selloff",
    "outflow",
    "inflation",
    "hike",
    "war",
    "volatility",
}


def analyze_sentiment(text: str) -> dict:
    lower = text.lower()
    bullish_hits = [term for term in BULLISH_TERMS if term in lower]
    bearish_hits = [term for term in BEARISH_TERMS if term in lower]
    raw_score = len(bullish_hits) - len(bearish_hits)
    if raw_score >= 2:
        sentiment = "bullish"
    elif raw_score <= -2:
        sentiment = "bearish"
    elif bullish_hits and bearish_hits:
        sentiment = "mixed"
    else:
        sentiment = "neutral"
    confidence = min(85, 45 + (len(bullish_hits) + len(bearish_hits)) * 8)
    return {
        "sentiment": sentiment,
        "sentimentScore": max(0, min(100, 50 + raw_score * 12)),
        "confidence": confidence,
        "bullishTerms": bullish_hits[:6],
        "bearishTerms": bearish_hits[:6],
    }
