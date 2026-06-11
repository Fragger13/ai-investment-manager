from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.financial_profile import FinancialProfile
from app.schemas.financial import OnboardingProfile


def latest_saved_profile(db: Session) -> OnboardingProfile:
    record = db.query(FinancialProfile).order_by(FinancialProfile.id.desc()).first()
    if not record:
        return OnboardingProfile()
    try:
        payload = json.loads(record.payload_json or "{}")
    except (TypeError, ValueError, json.JSONDecodeError):
        return OnboardingProfile()
    try:
        return OnboardingProfile(**payload)
    except (TypeError, ValueError):
        return OnboardingProfile()


def resolve_profile(db: Session, profile: OnboardingProfile | None = None) -> OnboardingProfile:
    if has_meaningful_profile(profile):
        return profile  # type: ignore[return-value]
    saved = latest_saved_profile(db)
    return saved if has_meaningful_profile(saved) else profile or saved


def has_meaningful_profile(profile: OnboardingProfile | None) -> bool:
    if profile is None:
        return False
    data = _profile_dict(profile)
    money_fields = [
        "monthlySalary",
        "monthlyCashInflow",
        "monthlyExpenses",
        "stocksValue",
        "mutualFundsValue",
        "cashBalance",
        "emergencyFundTarget",
        "retirementTarget",
    ]
    if any(_as_number(data.get(field)) > 0 for field in money_fields):
        return True
    goals = data.get("goals") or []
    if isinstance(goals, list) and any(_as_number(goal.get("targetAmount")) > 0 for goal in goals if isinstance(goal, dict)):
        return True
    return bool(str(data.get("name") or "").strip() and _as_number(data.get("age")) > 0)


def latest_profile_metadata(db: Session) -> dict[str, Any]:
    record = db.query(FinancialProfile).order_by(FinancialProfile.id.desc()).first()
    if not record:
        return {"exists": False, "hasData": False, "goalsCount": 0, "healthScore": 0}
    profile = latest_saved_profile(db)
    data = _profile_dict(profile)
    return {
        "exists": True,
        "hasData": has_meaningful_profile(profile),
        "goalsCount": len(data.get("goals") or []),
        "healthScore": record.health_score,
        "profileId": record.id,
    }


def _profile_dict(profile: OnboardingProfile) -> dict[str, Any]:
    if hasattr(profile, "model_dump"):
        return profile.model_dump(mode="json")
    return profile.dict()


def _as_number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0
