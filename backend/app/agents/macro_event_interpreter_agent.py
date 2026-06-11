from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

RULE_PATH = Path(__file__).resolve().parents[1] / "config" / "macro_signal_rules.json"


def interpret_macro_events(signals: list[dict]) -> list[dict]:
    text = " ".join(
        " ".join(
            [
                signal.get("title", ""),
                signal.get("summary", ""),
                " ".join(signal.get("macroThemes", [])),
                " ".join(signal.get("sectors", [])),
            ]
        )
        for signal in signals[:80]
    ).lower()
    interpreted = []
    for rule in _rules():
        hits = sum(1 for term in rule["terms"] if term in text)
        if not hits:
            continue
        beneficiaries = [*_clean_labels(rule.get("primary_beneficiaries", [])), *_clean_labels(rule.get("secondary_beneficiaries", []))]
        losers = _clean_labels(rule.get("potential_losers", []))
        impact = round(rule.get("confidence_base", 0.55) * 100)
        interpreted.append(
            {
                "id": rule.get("event_type", "MACRO_SIGNAL"),
                "eventType": rule.get("event_type", "MACRO_SIGNAL"),
                "category": _category_from_event(rule.get("event_type", "")),
                "headline": rule.get("headline", "Macro signal may affect allocation decisions"),
                "affectedSectors": beneficiaries,
                "beneficiaries": beneficiaries,
                "likelyBeneficiaries": beneficiaries,
                "losers": losers,
                "likelyLosers": losers,
                "signalDirection": rule.get("signal_direction", "mixed"),
                "confidence": min(94, impact + hits * 4),
                "timeHorizon": rule.get("time_horizon", "medium_term"),
                "supportingEvidence": [],
                "conflictingEvidence": [],
                "portfolioRelevance": min(95, impact + hits * 3),
                "recommendationLinkage": rule.get("recommended_action", ""),
                "supportingTerms": [term for term in rule["terms"] if term in text],
            }
        )
    return sorted(interpreted, key=lambda item: item["confidence"], reverse=True)


def best_event_for_asset(asset_name: str, asset_category: str, events: list[dict]) -> dict | None:
    haystack = f"{asset_name} {asset_category}".lower()
    for event in events:
        if any(sector.lower().replace("_", " ") in haystack for sector in event["beneficiaries"]):
            return event
    return events[0] if events and any(term in haystack for term in ["gold", "bank", "infra", "defence", "energy", "it"]) else None


@lru_cache(maxsize=1)
def _rules() -> list[dict]:
    try:
        return json.loads(RULE_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return []


def _clean_labels(values: list[str]) -> list[str]:
    return [value.replace("_", " ") for value in values]


def _category_from_event(event_type: str) -> str:
    if "DEFENCE" in event_type:
        return "Geopolitical"
    if "OIL" in event_type:
        return "Commodity"
    if "RUPEE" in event_type:
        return "Currency"
    if "EV" in event_type or "CAPEX" in event_type:
        return "Policy"
    return "Macro"
