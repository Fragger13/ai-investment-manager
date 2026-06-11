from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.backtesting.backtest_service import infer_strategy_type, run_strategy_backtest
from app.services.backtesting.benchmark_comparison_service import compare_against_benchmark
from app.services.backtesting.regime_backtest_service import validate_by_regime


def validate_tactical_setup(db: Session, asset: dict, recommendation: dict | None = None, regime: dict | None = None) -> dict:
    regime_name = (regime or {}).get("regime") or (regime or {}).get("regimeName") or "balanced"
    strategy_type = infer_strategy_type(asset, recommendation)
    strategy = run_strategy_backtest(db, asset, strategy_type)
    benchmark = compare_against_benchmark(db, asset, strategy)
    regime_result = validate_by_regime(db, strategy, current_regime=regime_name)
    reliability = _reliability_score(strategy, benchmark, regime_result)
    setup_quality = _setup_quality(reliability, strategy, benchmark)
    confidence = "high" if reliability >= 72 and strategy["sampleSize"] >= 20 else "medium" if reliability >= 50 and strategy["sampleSize"] >= 8 else "low"
    downgrade = _downgrade_reason(strategy, benchmark, reliability)
    return {
        "strategyType": strategy_type,
        "historicalReliability": reliability,
        "historicalWinRate": strategy["winRate"],
        "averageReturn": strategy["averageReturn"],
        "medianReturn": strategy["medianReturn"],
        "maxDrawdown": strategy["maxDrawdown"],
        "downsideDeviation": strategy["downsideDeviation"],
        "sharpeLike": strategy["sharpeLike"],
        "benchmarkComparison": benchmark,
        "regimePerformance": regime_result,
        "sampleSize": strategy["sampleSize"],
        "validationPeriod": strategy["validationPeriod"],
        "holdingPeriodDays": strategy["holdingPeriodDays"],
        "signalDecay": strategy["signalDecay"],
        "setupQuality": setup_quality,
        "confidenceLabel": confidence,
        "downgradeReason": downgrade,
        "convictionAdjustment": _conviction_adjustment(reliability, downgrade),
        "allocationMultiplier": _allocation_multiplier(reliability, downgrade),
        "actionAdjustment": "watchlist" if downgrade else "",
        "notes": _notes(strategy, benchmark, regime_result, downgrade),
        "disclaimer": "Historical validation is supporting evidence only. Past behavior does not predict future returns.",
    }


def _reliability_score(strategy: dict, benchmark: dict, regime_result: dict) -> int:
    score = (
        strategy.get("qualityScore", 30) * 0.48
        + benchmark.get("relativeQualityScore", 40) * 0.27
        + regime_result.get("currentRegimeReliability", 40) * 0.25
    )
    if strategy.get("sampleSize", 0) < 8:
        score = min(score, 42)
    if strategy.get("maxDrawdown", 0) < -35:
        score -= 8
    if benchmark.get("excessReturn", 0) < -2:
        score -= 6
    return max(5, min(92, round(score)))


def _setup_quality(reliability: int, strategy: dict, benchmark: dict) -> str:
    if strategy.get("sampleSize", 0) < 8:
        return "insufficient historical evidence"
    if reliability >= 72:
        return "supportive historical validation"
    if reliability >= 50:
        return "mixed but usable historical validation"
    if benchmark.get("relativeQualityScore", 0) < 45:
        return "weak benchmark-relative validation"
    return "weak historical validation"


def _downgrade_reason(strategy: dict, benchmark: dict, reliability: int) -> str:
    if strategy.get("sampleSize", 0) < 8:
        return "insufficient comparable historical samples"
    if reliability < 45:
        return "historical setup quality is weak"
    if benchmark.get("relativeQualityScore", 0) < 38:
        return "benchmark-relative validation is weak"
    if strategy.get("maxDrawdown", 0) < -45:
        return "historical drawdown profile is too severe"
    return ""


def _conviction_adjustment(reliability: int, downgrade: str) -> int:
    if downgrade:
        return -12
    if reliability >= 75:
        return 6
    if reliability >= 60:
        return 2
    return -5


def _allocation_multiplier(reliability: int, downgrade: str) -> float:
    if downgrade:
        return 0.5
    if reliability >= 75:
        return 1.0
    if reliability >= 55:
        return 0.8
    return 0.65


def _notes(strategy: dict, benchmark: dict, regime_result: dict, downgrade: str) -> list[str]:
    notes = [
        f"Win rate {strategy.get('winRate', 0)}% over {strategy.get('sampleSize', 0)} historical setup samples.",
        f"Max historical drawdown in the price series was {strategy.get('maxDrawdown', 0)}%.",
        f"Benchmark comparison: {benchmark.get('notes', '')}",
        f"Best regime: {regime_result.get('bestRegime', 'limited data')}; weakest regime: {regime_result.get('weakestRegime', 'limited data')}.",
    ]
    if downgrade:
        notes.append(f"Downgrade reason: {downgrade}.")
    return notes
