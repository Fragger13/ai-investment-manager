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
    history = [{"role": turn.role, "content": turn.content} for turn in (payload.history or [])]
    try:
        profile = resolve_profile(db, payload.profile)
        response = papa_chat_answer(db, payload.message, profile, history=history)
    except Exception:  # noqa: BLE001 — the chat must never hard-fail (LLM hiccup, load, bad state)
        response = ChatResponse(
            reply=(
                "Beta, I lost my train of thought for a second there. Ask me that once more — "
                "or rephrase it slightly — and I'll work through it with you properly."
            ),
            cards=[],
            suggestions=["Am I saving enough?", "Can I afford a car?", "What should I do today?"],
            mood="warm",
        )
    # Side effects must never break the reply that has already been formed.
    try:
        message_lower = (payload.message or "").lower()
        if "recommendation" in message_lower or "portfolio" in message_lower or "drift" in message_lower:
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
    except Exception:  # noqa: BLE001
        pass
    return response
