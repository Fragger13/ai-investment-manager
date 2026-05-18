import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.financial_profile import FinancialProfile
from app.models.goal import Goal
from app.models.portfolio import Portfolio
from app.models.recommendation import RecommendationRecord
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import build_dashboard, now_iso, profile_to_dict

router = APIRouter()


@router.post("")
def save_onboarding(profile: OnboardingProfile, db: Session = Depends(get_db)) -> dict[str, str | int]:
    dashboard = build_dashboard(profile)
    payload = profile_to_dict(profile)
    record = FinancialProfile(payload_json=json.dumps(payload), health_score=dashboard["health"]["score"])
    db.add(record)
    db.flush()

    db.add(Portfolio(allocations=json.dumps(dashboard["allocation"]), performance=json.dumps(dashboard["projection"])))
    for goal in dashboard["goals"]:
        db.add(Goal(name=goal["name"], target_amount=goal["targetAmount"], current_progress=goal["currentProgress"]))
    for recommendation in dashboard["recommendations"]:
        db.add(
            RecommendationRecord(
                recommendation_data=json.dumps(recommendation),
                confidence_score=recommendation["confidenceScore"],
                generated_at=now_iso(),
            )
        )
    db.commit()
    return {"status": "saved", "profileId": record.id, "name": profile.name}


@router.get("/latest")
def latest_profile(db: Session = Depends(get_db)) -> dict:
    record = db.query(FinancialProfile).order_by(FinancialProfile.id.desc()).first()
    if not record:
        return {"profile": None}
    return {"profile": json.loads(record.payload_json)}
