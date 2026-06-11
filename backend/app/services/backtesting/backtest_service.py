from __future__ import annotations

import json
import math
from statistics import median

from sqlalchemy.orm import Session

from app.models.historical_price_cache import HistoricalPriceCache
from app.models.strategy_backtest import StrategyBacktest
from app.services.assets.asset_intelligence_service import fetch_price_history
from app.services.intelligence import now_iso


HOLDING_PERIODS = {
    "moving_average_trend": 63,
    "breakout_setup": 42,
    "tactical_setup": 45,
    "sector_rotation": 63,
    "crypto_tactical": 30,
    "defensive_rotation": 84,
    "staggered_entry": 63,
}


def historical_price_history(db: Session, asset: dict, force_refresh: bool = False) -> dict:
    symbol = asset.get("ticker") or asset.get("asset_symbol") or asset.get("symbol") or asset.get("assetName", "")
    name = asset.get("assetName") or asset.get("name") or asset.get("instrumentName") or symbol
    if not force_refresh:
        row = (
            db.query(HistoricalPriceCache)
            .filter(HistoricalPriceCache.asset_symbol == symbol)
            .order_by(HistoricalPriceCache.id.desc())
            .first()
        )
        if row:
            return {
                "closes": _loads(row.closes_json),
                "volumes": _loads(row.volumes_json),
                "dataMode": row.data_mode,
                "sourceUrl": row.source_url,
                "retrievedAt": row.retrieved_at,
            }

    payload = {
        "ticker": symbol,
        "name": name,
        "assetClass": _asset_class(asset),
        "assetType": asset.get("assetType") or asset.get("asset_type") or "",
    }
    history = fetch_price_history(payload)
    closes = [round(float(value), 4) for value in history.get("closes", []) if isinstance(value, (int, float)) and value > 0]
    volumes = [round(float(value), 2) for value in history.get("volumes", []) if isinstance(value, (int, float)) and value >= 0]
    db.add(
        HistoricalPriceCache(
            asset_symbol=symbol,
            asset_name=name,
            asset_type=payload["assetType"],
            closes_json=json.dumps(closes),
            volumes_json=json.dumps(volumes),
            data_mode=history.get("dataMode", "limited"),
            source_url=history.get("sourceUrl", ""),
            retrieved_at=now_iso(),
        )
    )
    db.commit()
    return {**history, "closes": closes, "volumes": volumes, "retrievedAt": now_iso()}


def run_strategy_backtest(db: Session, asset: dict, strategy_type: str, force_refresh: bool = False) -> dict:
    history = historical_price_history(db, asset, force_refresh=force_refresh)
    closes = history.get("closes", [])
    volumes = history.get("volumes", [])
    name = asset.get("assetName") or asset.get("name") or asset.get("instrumentName") or asset.get("ticker", "")
    symbol = asset.get("ticker") or asset.get("symbol") or ""
    holding_period = HOLDING_PERIODS.get(strategy_type, 63)
    if len(closes) < max(90, holding_period + 30):
        result = _empty_result(asset, strategy_type, holding_period, history.get("dataMode", "limited"))
        _save_strategy_backtest(db, result)
        return result

    entries = _entry_indices(closes, volumes, strategy_type, holding_period)
    returns = _forward_returns(closes, entries, holding_period)
    result = _metrics_from_returns(
        asset,
        strategy_type,
        returns,
        closes,
        holding_period,
        history.get("dataMode", "limited"),
        history.get("retrievedAt", now_iso()),
    )
    result["priceSourceUrl"] = history.get("sourceUrl", "")
    result["sampleReturns"] = returns
    result["entryCount"] = len(entries)
    result["notes"] = _notes_for_result(result, name, symbol)
    _save_strategy_backtest(db, result)
    return result


def infer_strategy_type(asset: dict, recommendation: dict | None = None) -> str:
    rec = recommendation or {}
    text = " ".join(
        [
            str(rec.get("strategyBucket", "")),
            str(rec.get("recommendationType", "")),
            str(rec.get("assetType", asset.get("assetType", ""))),
            str(asset.get("assetType", "")),
            str(asset.get("category", "")),
        ]
    ).lower()
    if "crypto" in text:
        return "crypto_tactical"
    if "breakout" in text:
        return "breakout_setup"
    if any(term in text for term in ["tactical", "underdog", "event"]):
        return "tactical_setup"
    if any(term in text for term in ["gold", "debt", "liquid", "defensive"]):
        return "defensive_rotation"
    if any(term in text for term in ["etf", "equity", "stock", "share", "fund"]):
        return "moving_average_trend"
    return "staggered_entry"


def latest_strategy_backtests(db: Session, limit: int = 80) -> list[dict]:
    rows = db.query(StrategyBacktest).order_by(StrategyBacktest.id.desc()).limit(limit).all()
    return [_strategy_row(row) for row in rows]


def _entry_indices(closes: list[float], volumes: list[float], strategy_type: str, holding_period: int) -> list[int]:
    entries: list[int] = []
    max_index = len(closes) - holding_period - 1
    start = 210 if strategy_type == "moving_average_trend" else 60
    if strategy_type == "crypto_tactical":
        start = 45
    for index in range(start, max_index, 7):
        if _signal_active(closes, volumes, index, strategy_type):
            entries.append(index)
    if not entries and strategy_type in {"staggered_entry", "defensive_rotation"}:
        entries = list(range(30, max_index, 21))
    if not entries:
        entries = list(range(max(start, 60), max_index, 21))
    return entries[:120]


def _signal_active(closes: list[float], volumes: list[float], index: int, strategy_type: str) -> bool:
    price = closes[index]
    ma20 = _average(closes[index - 20 : index])
    ma50 = _average(closes[index - 50 : index])
    ma200 = _average(closes[index - 200 : index]) if index >= 200 else ma50
    prev_high = max(closes[index - 30 : index])
    recent_low = min(closes[index - 30 : index])
    drawdown = (price / max(closes[max(0, index - 90) : index]) - 1) * 100 if index > 10 else 0
    vol_ok = True
    if volumes and len(volumes) > index and index >= 20:
        vol_ok = volumes[index] >= _average(volumes[index - 20 : index]) * 0.85
    if strategy_type == "moving_average_trend":
        return price >= ma50 and ma20 >= ma50 and ma50 >= ma200 * 0.98
    if strategy_type == "breakout_setup":
        return price >= prev_high * 0.995 and vol_ok
    if strategy_type == "tactical_setup":
        return (price >= ma50 and price >= recent_low * 1.06) or price >= prev_high * 0.99
    if strategy_type == "crypto_tactical":
        return price >= ma20 or price <= ma50 * 0.92
    if strategy_type == "sector_rotation":
        return price >= ma50 and ma20 >= ma50 * 0.99
    if strategy_type == "defensive_rotation":
        return drawdown <= -6 or price >= ma50
    return index % 21 == 0


def _forward_returns(closes: list[float], entries: list[int], holding_period: int) -> list[float]:
    returns: list[float] = []
    for index in entries:
        exit_index = min(index + holding_period, len(closes) - 1)
        if closes[index] > 0:
            returns.append(round((closes[exit_index] / closes[index] - 1) * 100, 2))
    return returns


def _metrics_from_returns(asset: dict, strategy_type: str, returns: list[float], closes: list[float], holding_period: int, data_mode: str, retrieved_at: str) -> dict:
    sample_size = len(returns)
    avg_return = round(sum(returns) / sample_size, 2) if sample_size else 0
    median_return = round(median(returns), 2) if sample_size else 0
    volatility = round(_stddev(returns), 2) if sample_size > 1 else 0
    downside = round(_stddev([value for value in returns if value < 0]), 2) if any(value < 0 for value in returns) else 0
    win_rate = round(sum(1 for value in returns if value > 0) / sample_size * 100, 1) if sample_size else 0
    max_drawdown = round(_max_drawdown(closes), 2)
    sharpe_like = round((avg_return / volatility), 2) if volatility > 0 else 0
    decay = _signal_decay(returns)
    quality = _quality_score(sample_size, win_rate, avg_return, max_drawdown, sharpe_like, data_mode)
    interval = _confidence_interval(avg_return, volatility, sample_size)
    return {
        "assetSymbol": asset.get("ticker") or asset.get("symbol") or "",
        "assetName": asset.get("assetName") or asset.get("name") or asset.get("instrumentName") or asset.get("ticker", ""),
        "assetType": asset.get("assetType") or asset.get("asset_type") or "",
        "strategyType": strategy_type,
        "validationPeriod": "1y daily",
        "sampleSize": sample_size,
        "winRate": win_rate,
        "averageReturn": avg_return,
        "medianReturn": median_return,
        "volatility": volatility,
        "maxDrawdown": max_drawdown,
        "downsideDeviation": downside,
        "sharpeLike": sharpe_like,
        "hitRate": win_rate,
        "signalDecay": decay,
        "holdingPeriodDays": holding_period,
        "qualityScore": quality,
        "confidenceInterval": interval,
        "bestRegime": "pending regime split",
        "weakestRegime": "pending regime split",
        "dataMode": data_mode,
        "retrievedAt": retrieved_at,
    }


def _quality_score(sample_size: int, win_rate: float, avg_return: float, max_drawdown: float, sharpe_like: float, data_mode: str) -> int:
    score = 35
    score += min(sample_size, 60) * 0.35
    score += (win_rate - 50) * 0.45
    score += avg_return * 1.2
    score += min(max(sharpe_like, -1), 2) * 6
    score += max(max_drawdown, -45) * 0.35
    if data_mode == "live":
        score += 8
    elif data_mode in {"cached", "delayed"}:
        score += 4
    else:
        score -= 10
    if sample_size < 8:
        score = min(score, 42)
    return max(5, min(92, round(score)))


def _empty_result(asset: dict, strategy_type: str, holding_period: int, data_mode: str) -> dict:
    return {
        "assetSymbol": asset.get("ticker") or asset.get("symbol") or "",
        "assetName": asset.get("assetName") or asset.get("name") or asset.get("instrumentName") or "",
        "assetType": asset.get("assetType") or "",
        "strategyType": strategy_type,
        "validationPeriod": "insufficient history",
        "sampleSize": 0,
        "winRate": 0,
        "averageReturn": 0,
        "medianReturn": 0,
        "volatility": 0,
        "maxDrawdown": 0,
        "downsideDeviation": 0,
        "sharpeLike": 0,
        "hitRate": 0,
        "signalDecay": 0,
        "holdingPeriodDays": holding_period,
        "qualityScore": 20,
        "confidenceInterval": "insufficient historical sample",
        "bestRegime": "insufficient data",
        "weakestRegime": "insufficient data",
        "dataMode": data_mode,
        "retrievedAt": now_iso(),
        "sampleReturns": [],
        "entryCount": 0,
        "notes": "Insufficient historical data. Treat as low-confidence validation.",
    }


def _save_strategy_backtest(db: Session, result: dict) -> None:
    db.add(
        StrategyBacktest(
            asset_symbol=result["assetSymbol"],
            asset_name=result["assetName"],
            asset_type=result["assetType"],
            strategy_type=result["strategyType"],
            validation_period=result["validationPeriod"],
            sample_size=result["sampleSize"],
            win_rate=result["winRate"],
            average_return=result["averageReturn"],
            median_return=result["medianReturn"],
            volatility=result["volatility"],
            max_drawdown=result["maxDrawdown"],
            downside_deviation=result["downsideDeviation"],
            sharpe_like=result["sharpeLike"],
            hit_rate=result["hitRate"],
            signal_decay=result["signalDecay"],
            holding_period_days=result["holdingPeriodDays"],
            quality_score=result["qualityScore"],
            confidence_interval=result["confidenceInterval"],
            best_regime=result["bestRegime"],
            weakest_regime=result["weakestRegime"],
            data_mode=result["dataMode"],
            notes=result.get("notes", ""),
            retrieved_at=now_iso(),
        )
    )
    db.commit()


def _strategy_row(row: StrategyBacktest) -> dict:
    return {
        "id": row.id,
        "assetSymbol": row.asset_symbol,
        "assetName": row.asset_name,
        "assetType": row.asset_type,
        "strategyType": row.strategy_type,
        "validationPeriod": row.validation_period,
        "sampleSize": row.sample_size,
        "winRate": row.win_rate,
        "averageReturn": row.average_return,
        "medianReturn": row.median_return,
        "volatility": row.volatility,
        "maxDrawdown": row.max_drawdown,
        "downsideDeviation": row.downside_deviation,
        "sharpeLike": row.sharpe_like,
        "hitRate": row.hit_rate,
        "signalDecay": row.signal_decay,
        "holdingPeriodDays": row.holding_period_days,
        "qualityScore": row.quality_score,
        "confidenceInterval": row.confidence_interval,
        "bestRegime": row.best_regime,
        "weakestRegime": row.weakest_regime,
        "dataMode": row.data_mode,
        "notes": row.notes,
        "retrievedAt": row.retrieved_at,
    }


def _notes_for_result(result: dict, name: str, symbol: str) -> str:
    if result["sampleSize"] < 8:
        return f"{name or symbol} has too few comparable historical setup samples. Use low conviction."
    if result["qualityScore"] < 45:
        return "Historical validation is weak; downgrade active recommendation to Watchlist or reduce sizing."
    if result["maxDrawdown"] < -30:
        return "Historical drawdowns were deep. Keep sizing strict and review invalidation triggers."
    return "Historical setup validation is usable as supporting evidence, not as a return guarantee."


def _asset_class(asset: dict) -> str:
    text = f"{asset.get('assetClass', '')} {asset.get('assetType', '')}".lower()
    if "crypto" in text:
        return "crypto"
    if any(term in text for term in ["stock", "share", "bank", "leader", "oil", "pharma"]):
        return "equity"
    if "gold" in text:
        return "gold"
    if any(term in text for term in ["debt", "liquid"]):
        return "debt"
    return "equity"


def _max_drawdown(closes: list[float]) -> float:
    peak = closes[0] if closes else 0
    worst = 0.0
    for close in closes:
        peak = max(peak, close)
        if peak:
            worst = min(worst, close / peak - 1)
    return worst * 100


def _signal_decay(returns: list[float]) -> float:
    if len(returns) < 6:
        return 0
    first = sum(returns[: max(3, len(returns) // 3)]) / max(3, len(returns) // 3)
    last = sum(returns[-max(3, len(returns) // 3) :]) / max(3, len(returns) // 3)
    return round(first - last, 2)


def _confidence_interval(avg_return: float, volatility: float, sample_size: int) -> str:
    if sample_size < 8 or volatility <= 0:
        return "insufficient historical sample"
    margin = 1.96 * volatility / math.sqrt(sample_size)
    return f"{round(avg_return - margin, 2)}% to {round(avg_return + margin, 2)}%"


def _average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0


def _stddev(values: list[float]) -> float:
    if len(values) < 2:
        return 0
    avg = sum(values) / len(values)
    return math.sqrt(sum((value - avg) ** 2 for value in values) / (len(values) - 1))


def _loads(value: str) -> list[float]:
    try:
        return json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
