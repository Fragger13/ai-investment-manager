from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.financial import ChatRequest, ChatResponse, OnboardingProfile
from app.services.chat.chat_memory_service import save_chat_message
from app.services.chat.papa_chat_service import papa_chat_answer
from app.services.memory.adaptive_memory_service import record_user_action
from app.services.profile_resolution import latest_saved_profile, resolve_profile

router = APIRouter()


def _latest_profile(db: Session) -> OnboardingProfile:
    return latest_saved_profile(db)


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    profile = resolve_profile(db, payload.profile)
    history = [{"role": turn.role, "content": turn.content} for turn in (payload.history or [])]
    response = papa_chat_answer(db, payload.message, profile, history=history)
    if "recommendation" in payload.message.lower() or "portfolio" in payload.message.lower() or "drift" in payload.message.lower():
        record_user_action(
            db,
            {
                "actionType": "asked_ai",
                "entityType": "ai_chat",
                "entityId": "chat",
                "entityName": "AI financial assistant",
                "message": payload.message,
            },
        )
    save_chat_message(db, payload.message, response.reply)
    return response
