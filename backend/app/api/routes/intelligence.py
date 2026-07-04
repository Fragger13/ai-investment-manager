from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.routes.portfolio import _holdings
from app.core.database import get_db
from app.models.user_action_event import UserActionEvent
from app.schemas.financial import DashboardResponse, OnboardingProfile
from app.services.intelligence import build_dashboard
from app.services.profile_resolution import resolve_profile

router = APIRouter()


def _months_running(start_date: str, now: datetime) -> int:
    if not start_date:
        return 1
    try:
        start = datetime.fromisoformat(start_date)
    except ValueError:
        return 1
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    return max(1, (now - start).days // 30 + 1)


def _holdings_by_id(db: Session, profile: OnboardingProfile) -> dict[str, dict]:
    """Unified ``id -> {value, monthly}`` for every holding a goal can link to:
    manual/profile holdings (incl. the cash & EPF scalars, via the portfolio's
    canonical ``_holdings``) plus virtual action holdings (``action-{key}``) from
    taken SIPs. Goal funding is credited from this single map."""
    out: dict[str, dict] = {}
    for h in _holdings(profile):
        out[h["id"]] = {"value": int(h.get("value") or 0), "monthly": int(h.get("monthlyContribution") or 0)}
    now = datetime.now(UTC)
    rows = (
        db.query(UserActionEvent)
        .filter(UserActionEvent.action_type == "took_action")
        .order_by(UserActionEvent.id.desc())
        .limit(200)
        .all()
    )
    for row in rows:
        try:
            payload = json.loads(row.payload_json) if row.payload_json else {}
        except json.JSONDecodeError:
            payload = {}
        try:
            amount = float(payload.get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0.0
        if amount <= 0:
            continue
        key = row.entity_id or (row.entity_name or "").lower()
        if not key:
            continue
        hid = f"action-{key}"
        months = _months_running(str(payload.get("startDate") or ""), now)
        # A one-time lump sum credits its face value once and adds no recurring
        # monthly contribution (so it doesn't reduce a goal's required SIP).
        one_time = payload.get("cadence") == "one_time"
        entry = out.setdefault(hid, {"value": 0, "monthly": 0})
        entry["monthly"] = int(entry["monthly"]) + (0 if one_time else int(round(amount)))
        entry["value"] = int(entry["value"]) + int(round(amount if one_time else amount * max(months, 1)))
    return out


@router.post("/dashboard", response_model=DashboardResponse)
def dashboard(profile: OnboardingProfile, db: Session = Depends(get_db)) -> dict:
    resolved = resolve_profile(db, profile)
    return build_dashboard(resolved, holdings_by_id=_holdings_by_id(db, resolved))
