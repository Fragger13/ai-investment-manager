from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.financial_memory_agent import financial_timeline
from app.agents.recommendation_versioning_agent import recommendation_history_timeline
from app.agents.user_action_learning_agent import learn_from_user_action
from app.core.database import get_db
from app.models.user_action_event import UserActionEvent

router = APIRouter()


@router.get("/timeline")
def memory_timeline(db: Session = Depends(get_db)) -> dict:
    return financial_timeline(db)


@router.get("/recommendations/history")
def recommendations_history(db: Session = Depends(get_db)) -> list[dict]:
    return recommendation_history_timeline(db)


@router.post("/user-action")
def user_action(payload: dict, db: Session = Depends(get_db)) -> dict:
    return learn_from_user_action(db, payload)


@router.delete("/user-action/by-key/{key}")
def remove_user_action(key: str, db: Session = Depends(get_db)) -> dict:
    """Remove all took_action / added_to_plan events for a recommendation key.

    Lets the UI offer an Undo for a previously taken action so the portfolio
    math and saved-plan list stop reflecting it.
    """
    rows = (
        db.query(UserActionEvent)
        .filter(UserActionEvent.entity_id == key)
        .all()
    )
    deleted = 0
    for row in rows:
        db.delete(row)
        deleted += 1
    db.commit()
    return {"status": "ok", "deleted": deleted, "key": key}
