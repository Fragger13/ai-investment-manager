from fastapi import APIRouter

from app.services.alerts import list_alerts

router = APIRouter()


@router.get("")
def alerts() -> list[dict[str, str]]:
    return list_alerts()
