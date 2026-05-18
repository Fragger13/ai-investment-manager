from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.recommendation_action_agent import generate_advanced_recommendations
from app.agents.research_intelligence_agent import refresh_research
from app.core.database import get_db
from app.models.recommendation import RecommendationRecord
from app.models.recommendation_source import RecommendationSource
from app.schemas.financial import OnboardingProfile
from app.schemas.research import AdvancedRecommendationRequest, AdvancedRecommendationResponse
from app.services.research.source_cache_service import save_advanced_recommendation

router = APIRouter()


def _latest_profile(db: Session) -> OnboardingProfile:
    from app.models.financial_profile import FinancialProfile

    record = db.query(FinancialProfile).order_by(FinancialProfile.id.desc()).first()
    if not record:
        return OnboardingProfile()
    return OnboardingProfile(**json.loads(record.payload_json))


@router.post("/generate-advanced", response_model=AdvancedRecommendationResponse)
def generate(payload: AdvancedRecommendationRequest, db: Session = Depends(get_db)) -> dict:
    if payload.refreshResearch:
        refresh_research(db, force=True)
    profile = payload.profile or _latest_profile(db)
    result = generate_advanced_recommendations(profile, db)
    for recommendation in result["recommendations"]:
        save_advanced_recommendation(db, recommendation)
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
    if not advanced:
        result = generate_advanced_recommendations(_latest_profile(db), db)
        for recommendation in result["recommendations"]:
            save_advanced_recommendation(db, recommendation)
        return result
    advanced.sort(key=lambda item: item.get("priorityOrder", 999))
    timestamp = advanced[0].get("dataTimestamp", "")
    signals = advanced[0].get("supportingSignals", []) + advanced[0].get("contradictorySignals", [])
    return {
        "recommendations": advanced,
        "signals": signals,
        "assets": [],
        "dataMode": advanced[0].get("dataMode", "fallback"),
        "lastResearchedAt": timestamp,
        "sourceCount": len({source["url"] for rec in advanced for source in rec.get("sourceLinks", [])}),
        "disclaimer": advanced[0].get("disclaimer", "These recommendations are decision-support outputs, not guaranteed financial advice."),
    }


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
