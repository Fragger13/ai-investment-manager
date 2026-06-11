from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.benchmark_comparison import BenchmarkComparison
from app.services.backtesting.backtest_service import historical_price_history
from app.services.intelligence import now_iso


def compare_against_benchmark(db: Session, asset: dict, strategy_result: dict) -> dict:
    benchmark = _benchmark_for(asset)
    history = historical_price_history(db, benchmark)
    closes = history.get("closes", [])
    holding = max(strategy_result.get("holdingPeriodDays", 63), 21)
    returns = _benchmark_returns(closes, holding)
    sample_size = len(returns)
    benchmark_avg = round(sum(returns) / sample_size, 2) if sample_size else 0
    benchmark_win = round(sum(1 for value in returns if value > 0) / sample_size * 100, 1) if sample_size else 0
    strategy_avg = strategy_result.get("averageReturn", 0)
    excess = round(strategy_avg - benchmark_avg, 2)
    relative_quality = _relative_quality_score(excess, strategy_result.get("winRate", 0), benchmark_win, strategy_result.get("maxDrawdown", 0))
    result = {
        "assetSymbol": strategy_result.get("assetSymbol", ""),
        "assetName": strategy_result.get("assetName", ""),
        "strategyType": strategy_result.get("strategyType", ""),
        "benchmarkName": benchmark["name"],
        "benchmarkSymbol": benchmark["ticker"],
        "strategyAverageReturn": strategy_avg,
        "benchmarkAverageReturn": benchmark_avg,
        "excessReturn": excess,
        "benchmarkWinRate": benchmark_win,
        "relativeQualityScore": relative_quality,
        "notes": _notes(excess, relative_quality, sample_size),
        "retrievedAt": now_iso(),
    }
    db.add(
        BenchmarkComparison(
            asset_symbol=result["assetSymbol"],
            asset_name=result["assetName"],
            strategy_type=result["strategyType"],
            benchmark_name=result["benchmarkName"],
            benchmark_symbol=result["benchmarkSymbol"],
            strategy_average_return=result["strategyAverageReturn"],
            benchmark_average_return=result["benchmarkAverageReturn"],
            excess_return=result["excessReturn"],
            benchmark_win_rate=result["benchmarkWinRate"],
            relative_quality_score=result["relativeQualityScore"],
            notes=result["notes"],
            retrieved_at=result["retrievedAt"],
        )
    )
    db.commit()
    return result


def latest_benchmark_comparisons(db: Session, limit: int = 80) -> list[dict]:
    rows = db.query(BenchmarkComparison).order_by(BenchmarkComparison.id.desc()).limit(limit).all()
    return [
        {
            "id": row.id,
            "assetSymbol": row.asset_symbol,
            "assetName": row.asset_name,
            "strategyType": row.strategy_type,
            "benchmarkName": row.benchmark_name,
            "benchmarkSymbol": row.benchmark_symbol,
            "strategyAverageReturn": row.strategy_average_return,
            "benchmarkAverageReturn": row.benchmark_average_return,
            "excessReturn": row.excess_return,
            "benchmarkWinRate": row.benchmark_win_rate,
            "relativeQualityScore": row.relative_quality_score,
            "notes": row.notes,
            "retrievedAt": row.retrieved_at,
        }
        for row in rows
    ]


def _benchmark_for(asset: dict) -> dict:
    text = f"{asset.get('assetType', '')} {asset.get('assetClass', '')} {asset.get('ticker', '')}".lower()
    if "crypto" in text or asset.get("ticker") in {"BTC", "ETH", "SOL", "LINK"}:
        return {"name": "Bitcoin benchmark proxy", "ticker": "BTC"}
    if "gold" in text:
        return {"name": "Gold ETF benchmark proxy", "ticker": "GOLDBEES.NS"}
    return {"name": "NIFTY 50 benchmark proxy", "ticker": "^NSEI"}


def _benchmark_returns(closes: list[float], holding: int) -> list[float]:
    if len(closes) < holding + 30:
        return []
    return [
        round((closes[min(index + holding, len(closes) - 1)] / closes[index] - 1) * 100, 2)
        for index in range(30, len(closes) - holding - 1, 21)
        if closes[index] > 0
    ][:120]


def _relative_quality_score(excess: float, strategy_win: float, benchmark_win: float, max_drawdown: float) -> int:
    score = 50 + excess * 2 + (strategy_win - benchmark_win) * 0.35 + max(max_drawdown, -50) * 0.2
    return max(5, min(92, round(score)))


def _notes(excess: float, relative_quality: int, sample_size: int) -> str:
    if sample_size < 8:
        return "Benchmark sample is too small. Treat comparison as low confidence."
    if relative_quality < 45:
        return "Historical setup did not show strong benchmark-relative behavior. Reduce conviction."
    if excess > 0:
        return "Historical setup showed positive benchmark-relative behavior, but this is not predictive certainty."
    return "Historical setup was close to benchmark; use as neutral evidence."

