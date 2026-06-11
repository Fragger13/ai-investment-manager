from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.backtesting.signal_validation_service import validate_signal_reliability


def score_signal_quality(db: Session, signal_type: str, asset_class: str = "", market_regime: str = "balanced") -> dict:
    result = validate_signal_reliability(db, signal_type, asset_class, market_regime)
    quality = "high" if result["reliabilityScore"] >= 72 else "medium" if result["reliabilityScore"] >= 50 else "low"
    return {
        **result,
        "quality": quality,
        "explanation": (
            f"{signal_type} reliability is {quality} in {market_regime}; "
            f"sample size {result['sampleSize']}, hit rate {result['hitRate']}%, contradiction score {result['contradictionScore']}."
        ),
    }
