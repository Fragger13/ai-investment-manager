import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.financial_assistant import answer
from app.core.database import get_db
from app.models.activity_record import ActivityRecord
from app.models.financial_profile import FinancialProfile
from app.schemas.financial import ChatRequest, ChatResponse, OnboardingProfile
from app.services.intelligence import now_iso

router = APIRouter()


def _latest_profile(db: Session) -> OnboardingProfile:
    record = db.query(FinancialProfile).order_by(FinancialProfile.id.desc()).first()
    if not record:
        return OnboardingProfile()
    return OnboardingProfile(**json.loads(record.payload_json))


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    profile = payload.profile or _latest_profile(db)
    reply = answer(payload.message, profile)
    db.add(
        ActivityRecord(
            record_type="chat",
            payload_json=json.dumps({"message": payload.message, "reply": reply}),
            created_at=now_iso(),
        )
    )
    db.commit()
    return ChatResponse(reply=reply)
