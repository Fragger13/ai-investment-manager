from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.alert_priority_engine import prioritize_alerts
from app.core.database import get_db
from app.services.alerts import list_alerts
from app.services.memory.adaptive_memory_service import drift_alerts

router = APIRouter()


@router.get("")
def alerts() -> list[dict]:
    return prioritize_alerts(list_alerts())


@router.get("/drift")
def adaptive_drift_alerts(db: Session = Depends(get_db)) -> list[dict]:
    return prioritize_alerts(drift_alerts(db))
