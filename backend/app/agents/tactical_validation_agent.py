from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.backtesting.tactical_setup_validator import validate_tactical_setup


def validate_recommendation_tactics(db: Session, asset: dict, recommendation: dict, regime: dict) -> dict:
    validation = validate_tactical_setup(db, asset, recommendation, regime)
    if validation.get("downgradeReason"):
        validation["recommendationImpact"] = "Downgrade to Watchlist or reduce sizing until evidence improves."
    elif validation.get("historicalReliability", 0) >= 70:
        validation["recommendationImpact"] = "Historical setup evidence can support conviction, while keeping risk controls."
    else:
        validation["recommendationImpact"] = "Keep sizing conservative because validation is mixed."
    return validation

