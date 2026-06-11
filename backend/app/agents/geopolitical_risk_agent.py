from __future__ import annotations


def assess_geopolitical_risk(signals: list[dict]) -> dict:
    text = " ".join(f"{signal.get('title', '')} {signal.get('summary', '')}" for signal in signals[:80]).lower()
    terms = ["war", "geopolitical", "border", "sanction", "oil shock", "shipping", "conflict", "red sea"]
    hits = [term for term in terms if term in text]
    score = min(90, 35 + len(hits) * 12)
    return {
        "riskScore": score,
        "riskLevel": "High" if score >= 65 else "Medium" if score >= 45 else "Low",
        "drivers": hits or ["No strong geopolitical stress terms in current source set"],
        "hedgeAssets": ["gold", "defence", "energy"] if hits else ["gold"],
    }
