from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.financial import (
    ChatRequest,
    ChatResponse,
    GoalClarifyRequest,
    GoalClarifyResponse,
    GoalEstimateRequest,
    GoalEstimateResponse,
    OnboardingProfile,
)
from app.services.chat.chat_memory_service import save_chat_message
from app.services.chat.papa_chat_service import papa_chat_answer
from app.services.goals.goal_clarify_service import clarify_goal
from app.services.goals.goal_estimate_service import estimate_goal_amount
from app.services.goals.goal_estimator import estimate_goal
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


@router.post("/goal-estimate", response_model=GoalEstimateResponse)
def goal_estimate(payload: GoalEstimateRequest, db: Session = Depends(get_db)) -> GoalEstimateResponse:
    """Estimate a ballpark target amount for an onboarding goal from a few
    quick-reply answers. Hybrid: a deterministic India cost+inflation baseline,
    optionally refined by the LLM, with the baseline as an instant fallback."""
    profile_dict = None
    try:
        profile_obj = resolve_profile(db, payload.profile)
        if profile_obj is not None:
            profile_dict = profile_obj.model_dump()
    except Exception:  # noqa: BLE001
        profile_dict = payload.profile.model_dump() if payload.profile else None

    try:
        result = estimate_goal_amount(payload.goalType, payload.answers, profile_dict)
    except Exception:  # noqa: BLE001 — never hard-fail onboarding; fall back to the pure calculator
        result = {**estimate_goal(payload.goalType, payload.answers, profile_dict), "source": "calculator"}
    return GoalEstimateResponse(**result)


@router.post("/goal-clarify", response_model=GoalClarifyResponse)
def goal_clarify(payload: GoalClarifyRequest, db: Session = Depends(get_db)) -> GoalClarifyResponse:
    """For a free-form ("Something else") goal, return clarifying questions
    tailored to what the user described."""
    profile_dict = None
    try:
        profile_obj = resolve_profile(db, payload.profile)
        if profile_obj is not None:
            profile_dict = profile_obj.model_dump()
    except Exception:  # noqa: BLE001
        profile_dict = payload.profile.model_dump() if payload.profile else None

    try:
        result = clarify_goal(payload.description, profile_dict)
    except Exception:  # noqa: BLE001
        result = {"questions": []}
    return GoalClarifyResponse(**result)
