import json

from fastapi import APIRouter, Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.financial_profile import FinancialProfile
from app.models.goal import Goal
from app.models.portfolio import Portfolio
from app.models.recommendation import RecommendationRecord
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.financial import OnboardingProfile
from app.services.intelligence import build_dashboard, monthly_income, now_iso, profile_to_dict
from app.services.memory.adaptive_memory_service import snapshot_profile

router = APIRouter()

REQUIRED_TEXT_FIELDS = [
    "name",
    "dateOfBirth",
    "occupation",
    "city",
    "maritalStatus",
    "shortTermLossTolerance",
    "shortTermHorizon",
    "shortTermVolatilityComfort",
    "opportunityPreference",
    "drawdownTolerance",
    "investmentHorizon",
    "spendingDiscipline",
    "emotionalSpendingTendency",
    "investmentPsychology",
    "riskReaction",
    "tracksExpenses",
    "investsMonthly",
    "panicSellRisk",
    "investingBlocker",
]


def _current_user_from_authorization(authorization: str | None, db: Session) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if decoded.get("type") != "access" or not decoded.get("sub"):
        return None
    return UserRepository(db).get_by_email(decoded["sub"])


def _missing_completion_fields(profile: OnboardingProfile) -> list[str]:
    missing = [field for field in REQUIRED_TEXT_FIELDS if not str(getattr(profile, field, "") or "").strip()]
    if profile.age <= 0:
        missing.append("age")
    if monthly_income(profile) <= 0:
        missing.append("monthlyCashInflow")
    if not profile.goals:
        missing.append("goals")
    if profile.hasEmiLoans is True and not profile.emiLoans:
        missing.append("emiLoans")
    for index, goal in enumerate(profile.goals):
        prefix = f"goals[{index}]"
        if not goal.type:
            missing.append(f"{prefix}.type")
        if goal.type == "Other" and not goal.customName.strip():
            missing.append(f"{prefix}.customName")
        if goal.priority < 1:
            missing.append(f"{prefix}.priority")
        if goal.paymentStyle == "emi" and goal.tenureYears < 1:
            missing.append(f"{prefix}.tenureYears")
    for index, loan in enumerate(profile.emiLoans):
        prefix = f"emiLoans[{index}]"
        if not loan.productType:
            missing.append(f"{prefix}.productType")
        if not loan.name:
            missing.append(f"{prefix}.name")
        if loan.monthlyEmiAmount <= 0:
            missing.append(f"{prefix}.monthlyEmiAmount")
        if not loan.startDate:
            missing.append(f"{prefix}.startDate")
        if not loan.endDate:
            missing.append(f"{prefix}.endDate")
        if loan.startDate and loan.endDate and loan.endDate < loan.startDate:
            missing.append(f"{prefix}.endDateAfterStartDate")
    return missing


@router.post("")
def save_onboarding(
    profile: OnboardingProfile,
    authorization: str | None = Header(default=None),
    partial: bool = False,
    db: Session = Depends(get_db),
) -> dict[str, str | int]:
    # `partial=true` lets the UI update a portion of an already-saved profile
    # (linking holdings to a goal, editing one goal's fields) without
    # re-validating the entire onboarding flow. The full check still runs for
    # the first-time onboarding submit.
    if not partial:
        missing = _missing_completion_fields(profile)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Onboarding is incomplete. Missing: {', '.join(sorted(set(missing)))}",
            )
    user = _current_user_from_authorization(authorization, db)
    dashboard = build_dashboard(profile)
    payload = profile_to_dict(profile)
    record = FinancialProfile(
        user_id=user.id if user else None,
        payload_json=json.dumps(payload),
        health_score=dashboard["health"]["score"],
    )
    db.add(record)
    db.flush()

    db.add(Portfolio(allocations=json.dumps(dashboard["allocation"]), performance=json.dumps(dashboard["projection"])))
    for goal in dashboard["goals"]:
        db.add(Goal(name=goal["name"], target_amount=goal["targetAmount"], current_progress=goal["currentProgress"]))
    for recommendation in dashboard["recommendations"]:
        db.add(
            RecommendationRecord(
                recommendation_data=json.dumps(recommendation),
                confidence_score=recommendation["confidenceScore"],
                generated_at=now_iso(),
            )
        )
    # Only mark the user as onboarded on the FINAL (non-partial) submit.
    # Partial auto-saves should never flip this flag — otherwise a user mid-flow
    # is treated as "done" and re-logins can route them past their pending sections.
    if user and not partial:
        user.onboarding_complete = True
    db.commit()
    snapshot_profile(db, profile, "onboarding_saved")
    return {"status": "saved", "profileId": record.id, "name": profile.name}


@router.get("/latest")
def latest_profile(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    user = _current_user_from_authorization(authorization, db)
    query = db.query(FinancialProfile)
    if user:
        query = query.filter(FinancialProfile.user_id == user.id)
    record = query.order_by(FinancialProfile.id.desc()).first()
    if not record:
        return {"profile": None}
    return {"profile": json.loads(record.payload_json)}
