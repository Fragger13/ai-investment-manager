from __future__ import annotations

from app.services.optimization.risk_model_service import BUCKET_ASSUMPTIONS


def portfolio_volatility_score(targets: dict[str, int]) -> int:
    weighted = sum(targets.get(bucket, 0) * BUCKET_ASSUMPTIONS[bucket]["volatility"] for bucket in targets) / 100
    return max(1, min(95, round(weighted)))


def volatility_budget_notes(targets: dict[str, int], max_score: int) -> list[str]:
    score = portfolio_volatility_score(targets)
    notes = [f"Your estimated ups-and-downs score is {score}, compared with a suggested limit of {max_score}."]
    if score > max_score:
        notes.append("Reduce short-term ideas, digital assets, or stock-heavy investments before adding more high-risk ideas.")
    if targets.get("cash_buffer", 0) < 3:
        notes.append("Your extra cash buffer is small. Add money gradually instead of investing a large amount at once.")
    return notes
