from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.asset_correlation_cache import AssetCorrelationCache
from app.services.intelligence import now_iso


CORRELATIONS = {
    ("core_long_term_wealth", "goal_specific_investments"): 72,
    ("core_long_term_wealth", "tactical_opportunities"): 78,
    ("core_long_term_wealth", "defensive_hedge"): 20,
    ("core_long_term_wealth", "crypto_high_risk"): 45,
    ("core_long_term_wealth", "cash_buffer"): 5,
    ("goal_specific_investments", "defensive_hedge"): 25,
    ("tactical_opportunities", "crypto_high_risk"): 55,
    ("defensive_hedge", "cash_buffer"): 10,
    ("emergency_reserve", "cash_buffer"): 35,
}


def estimate_correlation(bucket_a: str, bucket_b: str) -> int:
    if bucket_a == bucket_b:
        return 100
    return CORRELATIONS.get((bucket_a, bucket_b), CORRELATIONS.get((bucket_b, bucket_a), 30))


def save_correlation_cache(db: Session, bucket_keys: list[str]) -> None:
    retrieved_at = now_iso()
    for index, bucket_a in enumerate(bucket_keys):
        for bucket_b in bucket_keys[index + 1 :]:
            db.add(
                AssetCorrelationCache(
                    asset_a=bucket_a,
                    asset_b=bucket_b,
                    correlation=estimate_correlation(bucket_a, bucket_b),
                    data_mode="assumption",
                    source="Phase 7E bucket correlation assumption model",
                    retrieved_at=retrieved_at,
                )
            )
    db.commit()


def overlap_warnings(targets: dict[str, int]) -> list[str]:
    warnings = []
    equity_like = targets.get("core_long_term_wealth", 0) + targets.get("goal_specific_investments", 0) + targets.get("tactical_opportunities", 0)
    if equity_like > 75:
        warnings.append("A large share of your money depends on the stock market. Consider spreading it out more.")
    if targets.get("tactical_opportunities", 0) + targets.get("crypto_high_risk", 0) > 18:
        warnings.append("Short-term ideas and digital assets together may cause larger ups and downs.")
    return warnings
