from __future__ import annotations


def interpret_macro_signal(signal: dict) -> dict:
    text = _text(signal)
    beneficiaries: set[str] = set()
    losers: set[str] = set()
    risks: list[str] = []
    drivers: list[str] = []

    if any(term in text for term in ["rate cut", "repo cut", "liquidity", "vrr", "open market operation"]):
        beneficiaries.update(["banks", "NBFCs", "real estate", "autos", "capital markets"])
        losers.update(["deposit spreads"])
        risks.extend(["deposit margin pressure", "inflation may return if liquidity stays loose"])
        drivers.append("rates/liquidity easing signal")
    if any(term in text for term in ["rate hike", "yield spike", "bond yield", "tight liquidity"]):
        beneficiaries.update(["short-duration debt", "cash-like instruments"])
        losers.update(["rate-sensitive equities", "high-duration growth stocks"])
        risks.extend(["borrowing costs may rise", "valuation pressure on long-duration assets"])
        drivers.append("rate/yield pressure signal")
    if any(term in text for term in ["inflation", "cpi", "food prices", "crude"]):
        beneficiaries.update(["gold", "energy", "short-duration debt"])
        losers.update(["consumer discretionary", "airlines", "paint", "chemicals"])
        risks.extend(["inflation pressure", "margin compression"])
        drivers.append("inflation pressure signal")
    if any(term in text for term in ["rupee", "currency", "dollar", "forex"]):
        beneficiaries.update(["IT", "pharma", "exporters"])
        losers.update(["import-heavy sectors"])
        risks.append("currency volatility")
        drivers.append("currency movement signal")

    return {
        "beneficiaries": sorted(beneficiaries),
        "losers": sorted(losers),
        "risks": risks,
        "drivers": drivers,
        "shortTermImpact": "Macro signals may affect rates, liquidity, currency, and near-term market appetite.",
        "longTermImpact": "Sustained macro changes can shift asset allocation between equity, debt, gold, and cash buffers.",
    }


def _text(signal: dict) -> str:
    return " ".join(
        [
            signal.get("summary", ""),
            signal.get("title", ""),
            signal.get("signalType", ""),
            " ".join(signal.get("macroThemes", [])),
            " ".join(signal.get("riskSignals", [])),
            " ".join(signal.get("opportunitySignals", [])),
        ]
    ).lower()
