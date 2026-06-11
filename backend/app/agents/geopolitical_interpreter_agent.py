from __future__ import annotations


def interpret_geopolitical_signal(signal: dict) -> dict:
    text = _text(signal)
    beneficiaries: set[str] = set()
    losers: set[str] = set()
    risks: list[str] = []
    drivers: list[str] = []

    if any(term in text for term in ["war", "conflict", "geopolitical", "border", "sanction", "red sea", "strait"]):
        beneficiaries.update(["defence", "gold", "upstream oil", "energy security", "shipping"])
        losers.update(["airlines", "paint", "chemicals", "logistics", "import-heavy sectors"])
        risks.extend(["oil shock risk", "currency pressure", "supply-chain disruption"])
        drivers.append("geopolitical risk signal")
    if any(term in text for term in ["oil", "crude", "fuel"]):
        beneficiaries.update(["upstream oil", "energy"])
        losers.update(["airlines", "paint", "chemicals", "transport"])
        risks.append("fuel-price inflation")
        drivers.append("oil-linked geopolitical signal")

    return {
        "beneficiaries": sorted(beneficiaries),
        "losers": sorted(losers),
        "risks": risks,
        "drivers": drivers,
        "shortTermImpact": "Geopolitical shocks usually raise volatility and can push investors toward hedges.",
        "longTermImpact": "If the event persists, it can change sector margins, currency trends, and defence or energy allocation.",
    }


def _text(signal: dict) -> str:
    return " ".join(
        [
            signal.get("summary", ""),
            signal.get("title", ""),
            " ".join(signal.get("macroThemes", [])),
            " ".join(signal.get("sectors", [])),
        ]
    ).lower()
