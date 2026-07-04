from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.agents.financial_memory_agent import financial_timeline
from app.agents.recommendation_versioning_agent import recommendation_history_timeline
from app.agents.user_action_learning_agent import learn_from_user_action
from app.core.database import get_db
from app.core.security import user_from_bearer
from app.models.user_action_event import UserActionEvent

router = APIRouter()


@router.get("/timeline")
def memory_timeline(db: Session = Depends(get_db)) -> dict:
    return financial_timeline(db)


@router.get("/recommendations/history")
def recommendations_history(db: Session = Depends(get_db)) -> list[dict]:
    return recommendation_history_timeline(db)


@router.post("/user-action")
def user_action(
    payload: dict,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    # Stamp the event with its owner so portfolio views can stay per-user.
    user = user_from_bearer(authorization, db)
    return learn_from_user_action(db, payload, user_id=user.id if user else None)


@router.delete("/user-action/by-key/{key}")
def remove_user_action(
    key: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Remove all took_action / added_to_plan events for a recommendation key.

    Lets the UI offer an Undo for a previously taken action so the portfolio
    math and saved-plan list stop reflecting it. Scoped to the caller: an
    authenticated user can only undo their own events; guests only guest ones.
    """
    user = user_from_bearer(authorization, db)
    query = db.query(UserActionEvent).filter(UserActionEvent.entity_id == key)
    if user:
        query = query.filter(UserActionEvent.user_id == user.id)
    else:
        query = query.filter(UserActionEvent.user_id.is_(None))
    rows = query.all()
    deleted = 0
    for row in rows:
        db.delete(row)
        deleted += 1
    db.commit()
    return {"status": "ok", "deleted": deleted, "key": key}
