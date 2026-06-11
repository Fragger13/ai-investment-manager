from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.recommendation_action_agent import generate_advanced_recommendations
from app.agents.explainability_agent import build_recommendation_explainability, persist_recommendation_explainability
from app.agents.goal_impact_agent import attach_goal_impacts
from app.agents.master_orchestrator_agent import consolidate_recommendation_response
from app.agents.recommendation_reassessment_agent import reassess_recommendation_set
from app.agents.recommendation_versioning_agent import recommendation_version_history, version_recommendation_batch
from app.agents.research_intelligence_agent import refresh_research
from app.core.database import get_db
from app.models.recommendation import RecommendationRecord
from app.models.recommendation_source import RecommendationSource
from app.schemas.financial import OnboardingProfile
from app.schemas.research import AdvancedRecommendationRequest, AdvancedRecommendationResponse
from app.services.cache.intelligence_cache import clear_cache_namespace, get_cached, make_cache_key, set_cached
from app.services.llm.background_enhancement_service import hydrate_and_schedule_recommendations
from app.services.profile_resolution import latest_saved_profile, resolve_profile
from app.services.research.source_cache_service import save_advanced_recommendation

router = APIRouter()


def _latest_profile(db: Session) -> OnboardingProfile:
    return latest_saved_profile(db)


@router.post("/generate-advanced", response_model=AdvancedRecommendationResponse)
def generate(payload: AdvancedRecommendationRequest, db: Session = Depends(get_db)) -> dict:
    if payload.refreshResearch:
        refresh_research(db, force=True)
        clear_cache_namespace("recommendations")
    profile = resolve_profile(db, payload.profile)
    cache_key = make_cache_key("advanced", _profile_cache_payload(profile))
    if not payload.refreshResearch:
        cached = get_cached("recommendations", cache_key)
        if cached and _is_final_orchestrated(cached):
            cached = dict(cached)
            _ensure_goal_impacts(cached)
            _ensure_response_llm_enhanced(cached)
            cached["recommendations"] = hydrate_and_schedule_recommendations(cached.get("recommendations", []))
            cached["cacheStatus"] = "cached"
            set_cached("recommendations", cache_key, cached, ttl_seconds=240)
            return cached
    result = generate_advanced_recommendations(profile, db)
    _ensure_goal_impacts(result)
    result["recommendations"] = version_recommendation_batch(db, result["recommendations"], "recommendation generation")
    for index, recommendation in enumerate(result["recommendations"]):
        _ensure_explainability(recommendation, llm_enhance=False)
    result["recommendations"] = hydrate_and_schedule_recommendations(result["recommendations"])
    for recommendation in result["recommendations"]:
        persist_recommendation_explainability(db, recommendation)
        save_advanced_recommendation(db, recommendation)
    result["cacheStatus"] = "fresh"
    set_cached("recommendations", cache_key, result, ttl_seconds=240)
    return result


@router.get("/latest", response_model=AdvancedRecommendationResponse)
def latest(db: Session = Depends(get_db)) -> dict:
    rows = db.query(RecommendationRecord).order_by(RecommendationRecord.id.desc()).limit(50).all()
    parsed = []
    for row in rows:
        data = json.loads(row.recommendation_data)
        if "recommendationTitle" in data:
            parsed.append(data)
    latest_timestamp = parsed[0].get("dataTimestamp", "") if parsed else ""
    advanced = [item for item in parsed if item.get("dataTimestamp") == latest_timestamp]
    if not advanced or not all(item.get("consensus") and item.get("committeeSupport") for item in advanced):
        result = generate_advanced_recommendations(_latest_profile(db), db)
        _ensure_goal_impacts(result)
        result["recommendations"] = version_recommendation_batch(db, result["recommendations"], "latest recommendation refresh")
        for index, recommendation in enumerate(result["recommendations"]):
            _ensure_explainability(recommendation, llm_enhance=False)
        result["recommendations"] = hydrate_and_schedule_recommendations(result["recommendations"])
        for recommendation in result["recommendations"]:
            persist_recommendation_explainability(db, recommendation)
            save_advanced_recommendation(db, recommendation)
        return result
    advanced.sort(key=lambda item: item.get("priorityOrder", 999))
    for recommendation in advanced:
        _ensure_explainability(recommendation, llm_enhance=False)
    advanced = hydrate_and_schedule_recommendations(advanced)
    timestamp = advanced[0].get("dataTimestamp", "")
    signals = advanced[0].get("supportingSignals", []) + advanced[0].get("contradictorySignals", [])
    result = {
        "recommendations": advanced,
        "signals": signals,
        "assets": [],
        "dataMode": advanced[0].get("dataMode", "fallback"),
        "lastResearchedAt": timestamp,
        "sourceCount": len({source["url"] for rec in advanced for source in rec.get("sourceLinks", [])}),
        "disclaimer": advanced[0].get("disclaimer", "These recommendations are educational decision-support outputs. Investments involve risk; verify sources before acting."),
    }
    _ensure_goal_impacts(result)
    result = consolidate_recommendation_response(result)
    _ensure_response_llm_enhanced(result)
    result["recommendations"] = hydrate_and_schedule_recommendations(result.get("recommendations", []))
    result["cacheStatus"] = "database"
    return result


def _is_final_orchestrated(payload: dict) -> bool:
    recommendations = payload.get("recommendations", [])
    if not recommendations:
        return False
    return bool(payload.get("finalOrchestration")) and all(rec.get("consensus") and rec.get("committeeSupport") for rec in recommendations)


def _ensure_explainability(recommendation: dict, llm_enhance: bool = False, force: bool = False) -> None:
    required_titles = {
        "Why am I seeing this?",
        "Why could this be a good time?",
        "What makes this promising?",
        "What should I be careful about?",
        "What should I do next?",
    }
    existing_titles = {item.get("title") for item in recommendation.get("explanationCards", [])}
    if not force and recommendation.get("confidenceBreakdown") and recommendation.get("reasoningChain") and required_titles.issubset(existing_titles) and (not llm_enhance or _is_llm_enhanced(recommendation)):
        return
    recommendation.update(build_recommendation_explainability(recommendation, llm_enhance=llm_enhance))


def _ensure_response_llm_enhanced(payload: dict) -> None:
    recommendations = payload.get("recommendations") or []
    if not recommendations:
        return
    for recommendation in recommendations:
        if not _is_llm_enhanced(recommendation):
            _ensure_explainability(recommendation, llm_enhance=False)


def _ensure_goal_impacts(payload: dict) -> None:
    payload["recommendations"] = [
        attach_goal_impacts(recommendation)
        for recommendation in payload.get("recommendations", [])
    ]


def _is_llm_enhanced(recommendation: dict) -> bool:
    return bool(recommendation.get("llm_enhanced") or recommendation.get("llmEnhanced"))


def _profile_cache_payload(profile: OnboardingProfile) -> dict:
    if hasattr(profile, "model_dump"):
        return profile.model_dump(mode="json")
    return profile.dict()


@router.get("/versions")
def versions(recommendationKey: str | None = None, db: Session = Depends(get_db)) -> list[dict]:
    return recommendation_version_history(db, recommendationKey)


@router.post("/reassess")
def reassess(payload: dict | None = None, db: Session = Depends(get_db)) -> dict:
    payload = payload or {}
    profile_data = payload.get("profile")
    profile = resolve_profile(db, OnboardingProfile(**profile_data) if profile_data else None)
    return reassess_recommendation_set(db, profile, payload.get("trigger", "manual reassessment"))


@router.post("/{recommendation_id}/refresh-explanation")
def refresh_explanation(recommendation_id: str, db: Session = Depends(get_db)) -> dict:
    row, recommendation = _find_recommendation_record(db, recommendation_id)
    if not row or not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    _ensure_explainability(recommendation, llm_enhance=False, force=True)
    recommendation = hydrate_and_schedule_recommendations([recommendation], force=True)[0]
    row.recommendation_data = json.dumps(recommendation)
    row.confidence_score = recommendation.get("confidenceScore", row.confidence_score)
    db.commit()
    return recommendation


@router.post("/refresh-explanations")
def refresh_explanations(payload: dict | None = None, db: Session = Depends(get_db)) -> dict:
    payload = payload or {}
    profile_data = payload.get("profile")
    profile = resolve_profile(db, OnboardingProfile(**profile_data) if profile_data else None)
    result = generate_advanced_recommendations(profile, db)
    _ensure_goal_impacts(result)
    result["recommendations"] = version_recommendation_batch(db, result["recommendations"], "batch explanation refresh")
    for recommendation in result["recommendations"]:
        _ensure_explainability(recommendation, llm_enhance=False)
    result["recommendations"] = hydrate_and_schedule_recommendations(result["recommendations"], force=True)
    for recommendation in result["recommendations"]:
        persist_recommendation_explainability(db, recommendation)
        save_advanced_recommendation(db, recommendation)
    result["cacheStatus"] = "llm-refreshed"
    return result


@router.get("/{recommendation_id}/sources")
def recommendation_sources(recommendation_id: int, db: Session = Depends(get_db)) -> dict:
    record = db.query(RecommendationRecord).filter(RecommendationRecord.id == recommendation_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rows = db.query(RecommendationSource).filter(RecommendationSource.recommendation_id == recommendation_id).all()
    return {
        "recommendationId": recommendation_id,
        "sources": [
            {
                "sourceName": row.source_name,
                "sourceUrl": row.source_url,
                "supportType": row.support_type,
                "retrievedAt": row.retrieved_at,
                "credibilityScore": row.credibility_score,
            }
            for row in rows
        ],
    }


def _find_recommendation_record(db: Session, identifier: str) -> tuple[RecommendationRecord | None, dict | None]:
    if identifier.isdigit():
        row = db.query(RecommendationRecord).filter(RecommendationRecord.id == int(identifier)).first()
        if row:
            return row, json.loads(row.recommendation_data)
    rows = db.query(RecommendationRecord).order_by(RecommendationRecord.id.desc()).limit(300).all()
    decoded = identifier.lower()
    for row in rows:
        try:
            data = json.loads(row.recommendation_data)
        except json.JSONDecodeError:
            continue
        keys = {
            str(data.get("recommendationKey", "")).lower(),
            str(data.get("id", "")).lower(),
            str(data.get("instrumentName", "")).lower(),
            str(data.get("ticker", "")).lower(),
        }
        if decoded in keys:
            return row, data
    return None, None
