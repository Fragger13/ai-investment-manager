from fastapi import APIRouter

from app.services.production.readiness import readiness_snapshot
from app.services.llm.background_enhancement_service import enhancement_queue_status

router = APIRouter()


@router.get("/readiness")
def readiness() -> dict:
    return readiness_snapshot()


@router.get("/llm-enhancement-status")
def llm_enhancement_status() -> dict:
    return enhancement_queue_status()
