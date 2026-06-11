from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.models.portfolio_validation_result import PortfolioValidationResult
from app.services.intelligence import now_iso


def validate_recommendation_portfolio(db: Session, recommendations: list[dict]) -> dict:
    if not recommendations:
        return {"status": "empty", "message": "No recommendations to validate."}
    buckets = Counter(rec.get("strategyBucket", rec.get("bucket", "Core")) for rec in recommendations)
    asset_types = Counter(rec.get("assetType", "") for rec in recommendations)
    total_allocation = sum(rec.get("suggestedAllocationPercentage", rec.get("allocationPercent", 0)) for rec in recommendations) or 1
    crypto_allocation = sum(rec.get("suggestedAllocationPercentage", 0) for rec in recommendations if rec.get("strategyBucket") == "Crypto")
    tactical_allocation = sum(
        rec.get("suggestedAllocationPercentage", 0)
        for rec in recommendations
        if rec.get("strategyBucket") in {"Tactical", "Event-driven", "Underdog", "Crypto"}
    )
    max_single = max((rec.get("suggestedAllocationPercentage", 0) for rec in recommendations), default=0)
    unique_assets = len(asset_types)
    diversification = max(10, min(95, unique_assets * 10 + len(buckets) * 8 - max(0, max_single - 25)))
    concentration = max(5, min(95, 100 - max_single * 2 - max(0, crypto_allocation - 5) * 4 - max(0, tactical_allocation - 20) * 2))
    estimated_vol = round(sum(_risk_weight(rec) * rec.get("suggestedAllocationPercentage", 0) for rec in recommendations) / total_allocation, 2)
    estimated_drawdown = round(-estimated_vol * 0.65, 2)
    notes = _portfolio_notes(max_single, crypto_allocation, tactical_allocation, diversification)
    result = {
        "portfolioKey": f"recommendations-{now_iso()}",
        "recommendationCount": len(recommendations),
        "diversificationScore": round(diversification),
        "concentrationScore": round(concentration),
        "estimatedVolatility": estimated_vol,
        "estimatedMaxDrawdown": estimated_drawdown,
        "cryptoRiskContribution": round(crypto_allocation, 2),
        "tacticalRiskContribution": round(tactical_allocation, 2),
        "hiddenConcentrationNotes": notes,
        "validationSummary": "Portfolio validation checks diversification, tactical stacking, crypto exposure, and single-position concentration.",
        "retrievedAt": now_iso(),
    }
    db.add(
        PortfolioValidationResult(
            portfolio_key=result["portfolioKey"],
            recommendation_count=result["recommendationCount"],
            diversification_score=result["diversificationScore"],
            concentration_score=result["concentrationScore"],
            estimated_volatility=result["estimatedVolatility"],
            estimated_max_drawdown=result["estimatedMaxDrawdown"],
            crypto_risk_contribution=result["cryptoRiskContribution"],
            tactical_risk_contribution=result["tacticalRiskContribution"],
            hidden_concentration_notes=result["hiddenConcentrationNotes"],
            validation_summary=result["validationSummary"],
            retrieved_at=result["retrievedAt"],
        )
    )
    db.commit()
    return result


def latest_portfolio_validations(db: Session, limit: int = 20) -> list[dict]:
    rows = db.query(PortfolioValidationResult).order_by(PortfolioValidationResult.id.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "portfolioKey": row.portfolio_key,
            "recommendationCount": row.recommendation_count,
            "diversificationScore": row.diversification_score,
            "concentrationScore": row.concentration_score,
            "estimatedVolatility": row.estimated_volatility,
            "estimatedMaxDrawdown": row.estimated_max_drawdown,
            "cryptoRiskContribution": row.crypto_risk_contribution,
            "tacticalRiskContribution": row.tactical_risk_contribution,
            "hiddenConcentrationNotes": row.hidden_concentration_notes,
            "validationSummary": row.validation_summary,
            "retrievedAt": row.retrieved_at,
        }
        for row in rows
    ]


def _risk_weight(rec: dict) -> int:
    if rec.get("strategyBucket") == "Crypto":
        return 85
    if rec.get("strategyBucket") in {"Tactical", "Underdog", "Event-driven"}:
        return 65
    return {"High": 70, "Medium": 45, "Low": 18}.get(rec.get("riskLevel", "Medium"), 45)


def _portfolio_notes(max_single: int, crypto_allocation: float, tactical_allocation: float, diversification: float) -> str:
    issues = []
    if max_single > 25:
        issues.append("single recommendation allocation is high")
    if crypto_allocation > 5:
        issues.append("crypto contribution needs strict cap")
    if tactical_allocation > 20:
        issues.append("tactical bucket may stack volatility")
    if diversification < 50:
        issues.append("diversification is limited")
    return "; ".join(issues) if issues else "No major hidden concentration issue detected from current recommendation mix."

