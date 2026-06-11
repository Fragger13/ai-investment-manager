from __future__ import annotations


def summarize_strategy_reliability(validation: dict) -> dict:
    reliability = validation.get("historicalReliability", 0)
    sample = validation.get("sampleSize", 0)
    if sample < 8:
        label = "Low confidence"
    elif reliability >= 72:
        label = "Supportive"
    elif reliability >= 50:
        label = "Mixed"
    else:
        label = "Weak"
    return {
        "label": label,
        "reliabilityScore": reliability,
        "summary": (
            f"Historical validation is {label.lower()}: win rate {validation.get('historicalWinRate', 0)}%, "
            f"max drawdown {validation.get('maxDrawdown', 0)}%, sample size {sample}."
        ),
        "caution": "This is historical setup validation only, not a prediction or guarantee.",
    }

