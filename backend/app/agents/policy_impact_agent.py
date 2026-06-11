from __future__ import annotations


def interpret_policy_signal(signal: dict) -> dict:
    text = _text(signal)
    beneficiaries: set[str] = set()
    losers: set[str] = set()
    risks: list[str] = []
    drivers: list[str] = []

    if any(term in text for term in ["budget", "capex", "infrastructure", "highway", "railway"]):
        beneficiaries.update(["cement", "steel", "capital goods", "construction", "logistics", "infrastructure"])
        losers.update(["overheated cyclicals"])
        risks.extend(["execution delays", "valuation overheating"])
        drivers.append("infrastructure/capex policy signal")
    if any(term in text for term in ["defence", "aerospace", "shipbuilding"]):
        beneficiaries.update(["defence", "electronics manufacturing", "shipbuilding", "aerospace suppliers"])
        risks.extend(["order timing risk", "policy execution risk"])
        drivers.append("defence policy signal")
    if any(term in text for term in ["ev", "electric vehicle", "battery", "charging"]):
        beneficiaries.update(["auto ancillaries", "batteries", "charging infrastructure", "specialty chemicals"])
        risks.extend(["subsidy policy risk", "technology obsolescence"])
        drivers.append("EV policy signal")
    if any(term in text for term in ["sebi", "regulation", "compliance", "penalty"]):
        beneficiaries.update(["quality financial platforms", "compliant intermediaries"])
        losers.update(["non-compliant market participants"])
        risks.append("regulatory action risk")
        drivers.append("capital-market regulation signal")

    return {
        "beneficiaries": sorted(beneficiaries),
        "losers": sorted(losers),
        "risks": risks,
        "drivers": drivers,
        "shortTermImpact": "Policy signals can quickly affect sector sentiment, but price moves may be uneven.",
        "longTermImpact": "Sustained policy spending or regulation can change sector earnings quality over multiple years.",
    }


def _text(signal: dict) -> str:
    return " ".join([signal.get("summary", ""), signal.get("title", ""), signal.get("sourceName", ""), " ".join(signal.get("macroThemes", []))]).lower()
