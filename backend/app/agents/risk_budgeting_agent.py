from __future__ import annotations

from app.services.optimization.risk_model_service import allocation_constraints
from app.services.recommendations.suitability_scoring_service import ProfileContext


def build_risk_budget(context: ProfileContext, regime: dict) -> dict:
    constraints = allocation_constraints(context, regime)
    return {
        "riskProfile": constraints["riskProfile"],
        "tacticalAllocationCap": constraints["tacticalAllocationCap"],
        "cryptoAllocationCap": constraints["cryptoAllocationCap"],
        "singleStockCap": constraints["singleStockCap"],
        "sectorCap": constraints["sectorCap"],
        "maxVolatilityScore": constraints["maxVolatilityScore"],
    }

