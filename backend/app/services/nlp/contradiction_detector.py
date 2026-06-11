from __future__ import annotations


def detect_contradictions(signals: list[dict]) -> list[dict]:
    buckets: dict[str, set[str]] = {}
    for signal in signals:
        keys = set(signal.get("sectors", [])) | set(signal.get("instruments", [])) | set(signal.get("macroThemes", []))
        sentiment = signal.get("sentiment", "neutral")
        if sentiment not in {"bullish", "bearish", "mixed"}:
            continue
        for key in keys:
            buckets.setdefault(key, set()).add(sentiment)
    contradictions = []
    for key, sentiments in buckets.items():
        if "bullish" in sentiments and "bearish" in sentiments:
            contradictions.append(
                {
                    "entity": key,
                    "conflict": "bullish_and_bearish_sources",
                    "summary": f"Sources disagree on {key}; reduce conviction until the signal is clearer.",
                }
            )
    return contradictions
