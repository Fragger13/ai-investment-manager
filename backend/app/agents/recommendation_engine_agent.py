from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.schemas.financial import OnboardingProfile
from app.services.intelligence import DISCLAIMER
from app.services.recommendations.asset_screening_service import screen_assets_for_recommendations
from app.services.recommendations.recommendation_builder import build_recommendation
from app.services.recommendations.suitability_scoring_service import build_profile_context


def generate_research_backed_recommendations(db: Session, profile: OnboardingProfile | None = None) -> dict:
    profile = profile or OnboardingProfile()
    context = build_profile_context(profile)
    assets, signals = screen_assets_for_recommendations(db)
    recommendations = []
    used_asset_keys = set()
    priority = 1
    for asset in assets:
        if asset.asset_key in used_asset_keys:
            continue
        recommendation = build_recommendation(profile, context, asset, signals, priority)
        if not recommendation:
            continue
        recommendations.append(recommendation)
        used_asset_keys.add(asset.asset_key)
        priority += 1
        if len(recommendations) >= 5:
            break

    recommendations.sort(key=lambda item: (item["priorityOrder"], -item["suitabilityScore"], -item["confidenceScore"]))
    for index, recommendation in enumerate(recommendations, start=1):
        recommendation["priorityOrder"] = index

    timestamp = datetime.now(UTC).isoformat(timespec="seconds")
    modes = [rec["dataMode"] for rec in recommendations]
    data_mode = "live" if "live" in modes else "cached" if "cached" in modes else "delayed" if "delayed" in modes else "limited" if "limited" in modes else "fallback"
    return {
        "recommendations": recommendations,
        "signals": [_compact_signal(signal) for signal in signals[:50]],
        "assets": [_asset_response(asset) for asset in assets[:30]],
        "dataMode": data_mode,
        "lastResearchedAt": timestamp,
        "sourceCount": len({source["url"] for rec in recommendations for source in rec.get("sourceLinks", [])}),
        "disclaimer": DISCLAIMER,
    }


def _asset_response(asset) -> dict:
    return {
        "instrumentName": asset.instrument_name,
        "assetType": asset.asset_type,
        "category": asset.category,
        "summary": asset.summary,
        "suitabilityNotes": asset.suitability_notes,
        "riskNotes": asset.risk_notes,
        "evidence": asset.evidence,
        "dataMode": asset.data_mode,
        "confidenceScore": asset.confidence_score,
        "retrievedAt": asset.retrieved_at,
    }


def _compact_signal(signal: dict) -> dict:
    item = dict(signal)
    item["summary"] = _shorten(item.get("summary", ""), 420)
    item["title"] = _shorten(item.get("title", item["summary"]), 90)
    return item


def _shorten(value: str, limit: int) -> str:
    value = " ".join((value or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "..."
