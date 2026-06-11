from __future__ import annotations


def analyze_sentiment(entity: str, entity_type: str, signals: list[dict]) -> dict:
    entity_text = entity.lower()
    related = []
    for signal in signals[:100]:
        haystack = " ".join(
            [
                signal.get("title", ""),
                signal.get("summary", ""),
                " ".join(signal.get("instruments", [])),
                " ".join(signal.get("sectors", [])),
                " ".join(signal.get("assetClasses", [])),
            ]
        ).lower()
        if entity_text in haystack or entity_type.lower() in haystack:
            related.append(signal)
    if not related:
        return {
            "entity": entity,
            "entityType": entity_type,
            "sentiment": "neutral",
            "sentimentScore": 50,
            "sourceCount": 0,
            "recencyScore": 45,
            "confidence": 35,
            "summary": "No strong recent investor-mood update was found.",
            "risks": ["Information about recent investor mood is limited."],
        }
    bullish = sum(1 for signal in related if signal.get("sentiment") == "bullish")
    bearish = sum(1 for signal in related if signal.get("sentiment") == "bearish")
    score = 50 + bullish * 8 - bearish * 8
    confidence = min(90, 35 + len(related) * 10 + sum(signal.get("credibilityScore", 50) for signal in related[:5]) // 20)
    sentiment = "positive" if score >= 60 else "negative" if score <= 40 else "mixed" if bullish and bearish else "neutral"
    return {
        "entity": entity,
        "entityType": entity_type,
        "sentiment": sentiment,
        "sentimentScore": max(5, min(95, score)),
        "sourceCount": len(related),
        "recencyScore": 70,
        "confidence": confidence,
        "summary": f"{len(related)} recent update(s) relate to {entity}. The overall investor mood is {sentiment}.",
        "risks": ["Investor mood can change quickly and should not be the only reason to invest."],
    }
