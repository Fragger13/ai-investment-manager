from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.regime_backtest_result import RegimeBacktestResult
from app.services.intelligence import now_iso


REGIME_ADJUSTMENTS = {
    "bull market": {"moving_average_trend": 12, "breakout_setup": 8, "tactical_setup": 8, "crypto_tactical": 5},
    "risk-on": {"moving_average_trend": 10, "breakout_setup": 9, "tactical_setup": 8, "crypto_tactical": 6},
    "momentum-led": {"moving_average_trend": 10, "breakout_setup": 10, "tactical_setup": 7},
    "high volatility": {"breakout_setup": -12, "tactical_setup": -10, "crypto_tactical": -14, "defensive_rotation": 8},
    "risk-off": {"defensive_rotation": 12, "moving_average_trend": -8, "crypto_tactical": -16, "tactical_setup": -10},
    "bear market": {"defensive_rotation": 10, "moving_average_trend": -12, "breakout_setup": -12, "crypto_tactical": -18},
    "inflationary": {"defensive_rotation": 8, "sector_rotation": 5, "crypto_tactical": -8},
    "defensive": {"defensive_rotation": 10, "tactical_setup": -6},
}


def validate_by_regime(db: Session, strategy_result: dict, current_regime: str = "balanced") -> dict:
    strategy_type = strategy_result.get("strategyType", "moving_average_trend")
    base = strategy_result.get("qualityScore", 35)
    regimes = ["bull market", "risk-on", "high volatility", "risk-off", "bear market", "defensive"]
    rows = []
    for regime in regimes:
        adjustment = REGIME_ADJUSTMENTS.get(regime, {}).get(strategy_type, 0)
        score = max(5, min(92, round(base + adjustment)))
        row = {
            "strategyType": strategy_type,
            "marketRegime": regime,
            "assetClass": strategy_result.get("assetType", ""),
            "sampleSize": strategy_result.get("sampleSize", 0),
            "winRate": max(0, min(100, strategy_result.get("winRate", 0) + adjustment * 0.4)),
            "averageReturn": round(strategy_result.get("averageReturn", 0) + adjustment * 0.08, 2),
            "maxDrawdown": strategy_result.get("maxDrawdown", 0),
            "reliabilityScore": score,
            "notes": _regime_note(strategy_type, regime, adjustment),
            "retrievedAt": now_iso(),
        }
        _save(db, row)
        rows.append(row)
    current_score = next((row["reliabilityScore"] for row in rows if row["marketRegime"] == current_regime), base)
    best = max(rows, key=lambda row: row["reliabilityScore"])
    weakest = min(rows, key=lambda row: row["reliabilityScore"])
    return {
        "currentRegime": current_regime,
        "currentRegimeReliability": current_score,
        "bestRegime": best["marketRegime"],
        "weakestRegime": weakest["marketRegime"],
        "regimeResults": rows,
    }


def latest_regime_backtests(db: Session, limit: int = 80) -> list[dict]:
    rows = db.query(RegimeBacktestResult).order_by(RegimeBacktestResult.id.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "strategyType": row.strategy_type,
            "marketRegime": row.market_regime,
            "assetClass": row.asset_class,
            "sampleSize": row.sample_size,
            "winRate": row.win_rate,
            "averageReturn": row.average_return,
            "maxDrawdown": row.max_drawdown,
            "reliabilityScore": row.reliability_score,
            "notes": row.notes,
            "retrievedAt": row.retrieved_at,
        }
        for row in rows
    ]


def _save(db: Session, row: dict) -> None:
    db.add(
        RegimeBacktestResult(
            strategy_type=row["strategyType"],
            market_regime=row["marketRegime"],
            asset_class=row["assetClass"],
            sample_size=row["sampleSize"],
            win_rate=row["winRate"],
            average_return=row["averageReturn"],
            max_drawdown=row["maxDrawdown"],
            reliability_score=row["reliabilityScore"],
            notes=row["notes"],
            retrieved_at=row["retrievedAt"],
        )
    )
    db.commit()


def _regime_note(strategy_type: str, regime: str, adjustment: int) -> str:
    if adjustment > 0:
        return f"{strategy_type} historically receives a positive reliability adjustment in {regime} regimes."
    if adjustment < 0:
        return f"{strategy_type} is penalized in {regime} regimes because signal failure risk can rise."
    return f"{strategy_type} has neutral regime adjustment for {regime}."

