from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.signal_reliability_score import SignalReliabilityScore
from app.models.signal_validation_result import SignalValidationResult
from app.models.strategy_backtest import StrategyBacktest
from app.services.intelligence import now_iso


def validate_signal_reliability(db: Session, signal_type: str, asset_class: str = "", market_regime: str = "balanced") -> dict:
    rows = (
        db.query(StrategyBacktest)
        .filter(StrategyBacktest.asset_type.ilike(f"%{asset_class}%") if asset_class else StrategyBacktest.id.isnot(None))
        .order_by(StrategyBacktest.id.desc())
        .limit(30)
        .all()
    )
    if rows:
        sample = sum(row.sample_size for row in rows)
        avg_return = round(sum(row.average_return for row in rows) / len(rows), 2)
        hit_rate = round(sum(row.hit_rate for row in rows) / len(rows), 1)
        decay = round(sum(row.signal_decay for row in rows) / len(rows), 2)
        base = round(sum(row.quality_score for row in rows) / len(rows))
    else:
        sample, avg_return, hit_rate, decay, base = 0, 0, 0, 0, 28
    contradiction = _contradiction_score(signal_type, market_regime)
    reliability = max(5, min(92, base - contradiction // 4 + _signal_type_bonus(signal_type)))
    if sample < 12:
        reliability = min(reliability, 42)
    confidence = "high" if reliability >= 72 and sample >= 25 else "medium" if reliability >= 50 and sample >= 12 else "low"
    result = {
        "signalType": signal_type,
        "assetClass": asset_class,
        "marketRegime": market_regime,
        "sampleSize": sample,
        "reliabilityScore": reliability,
        "contradictionScore": contradiction,
        "averageForwardReturn": avg_return,
        "hitRate": hit_rate,
        "signalDecay": decay,
        "confidenceLabel": confidence,
        "notes": _notes(reliability, sample, contradiction),
        "retrievedAt": now_iso(),
    }
    _save_validation(db, result)
    _save_reliability(db, result)
    return result


def latest_signal_validations(db: Session, limit: int = 80) -> list[dict]:
    rows = db.query(SignalValidationResult).order_by(SignalValidationResult.id.desc()).limit(limit).all()
    return [_signal_row(row) for row in rows]


def latest_signal_reliability_scores(db: Session, limit: int = 80) -> list[dict]:
    rows = db.query(SignalReliabilityScore).order_by(SignalReliabilityScore.id.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "signalType": row.signal_type,
            "setupType": row.setup_type,
            "assetClass": row.asset_class,
            "marketRegime": row.market_regime,
            "reliabilityScore": row.reliability_score,
            "evidenceScore": row.evidence_score,
            "sampleSize": row.sample_size,
            "averageReturn": row.average_return,
            "maxDrawdown": row.max_drawdown,
            "decayPenalty": row.decay_penalty,
            "confidenceLabel": row.confidence_label,
            "notes": row.notes,
            "retrievedAt": row.retrieved_at,
        }
        for row in rows
    ]


def _save_validation(db: Session, result: dict) -> None:
    db.add(
        SignalValidationResult(
            signal_type=result["signalType"],
            asset_class=result["assetClass"],
            market_regime=result["marketRegime"],
            sample_size=result["sampleSize"],
            reliability_score=result["reliabilityScore"],
            contradiction_score=result["contradictionScore"],
            average_forward_return=result["averageForwardReturn"],
            hit_rate=result["hitRate"],
            signal_decay=result["signalDecay"],
            confidence_label=result["confidenceLabel"],
            notes=result["notes"],
            retrieved_at=result["retrievedAt"],
        )
    )
    db.commit()


def _save_reliability(db: Session, result: dict) -> None:
    db.add(
        SignalReliabilityScore(
            signal_type=result["signalType"],
            setup_type=_setup_type_for_signal(result["signalType"]),
            asset_class=result["assetClass"],
            market_regime=result["marketRegime"],
            reliability_score=result["reliabilityScore"],
            evidence_score=max(10, min(92, result["reliabilityScore"] + result["sampleSize"] // 8)),
            sample_size=result["sampleSize"],
            average_return=result["averageForwardReturn"],
            max_drawdown=0,
            decay_penalty=max(0, round(result["signalDecay"])),
            confidence_label=result["confidenceLabel"],
            notes=result["notes"],
            retrieved_at=result["retrievedAt"],
        )
    )
    db.commit()


def _signal_row(row: SignalValidationResult) -> dict:
    return {
        "id": row.id,
        "signalType": row.signal_type,
        "assetClass": row.asset_class,
        "marketRegime": row.market_regime,
        "sampleSize": row.sample_size,
        "reliabilityScore": row.reliability_score,
        "contradictionScore": row.contradiction_score,
        "averageForwardReturn": row.average_forward_return,
        "hitRate": row.hit_rate,
        "signalDecay": row.signal_decay,
        "confidenceLabel": row.confidence_label,
        "notes": row.notes,
        "retrievedAt": row.retrieved_at,
    }


def _setup_type_for_signal(signal_type: str) -> str:
    lower = signal_type.lower()
    if "technical" in lower or "breakout" in lower:
        return "breakout_setup"
    if "crypto" in lower:
        return "crypto_tactical"
    if "sector" in lower or "policy" in lower or "macro" in lower:
        return "sector_rotation"
    if "risk" in lower or "defensive" in lower:
        return "defensive_rotation"
    return "moving_average_trend"


def _signal_type_bonus(signal_type: str) -> int:
    lower = signal_type.lower()
    if "fundamental" in lower:
        return 5
    if "sentiment" in lower:
        return -4
    if "crypto" in lower:
        return -6
    return 0


def _contradiction_score(signal_type: str, market_regime: str) -> int:
    text = f"{signal_type} {market_regime}".lower()
    if "breakout" in text and "high volatility" in text:
        return 35
    if "crypto" in text and ("risk-off" in text or "bear" in text):
        return 45
    if "momentum" in text and "bear" in text:
        return 35
    return 12


def _notes(reliability: int, sample: int, contradiction: int) -> str:
    if sample < 12:
        return "Insufficient comparable historical samples. Keep confidence low."
    if contradiction >= 35:
        return "Current regime contradicts this signal type; reduce conviction or use Watchlist."
    if reliability >= 70:
        return "Historical reliability is supportive, but not predictive certainty."
    return "Historical reliability is mixed; use only as secondary evidence."

