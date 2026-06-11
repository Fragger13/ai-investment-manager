from __future__ import annotations

from math import sqrt
from statistics import mean

from app.services.recommendations.asset_screening_service import ResearchAsset


def analyze_technicals(asset: ResearchAsset, regime: dict, supporting: list[dict], conflicting: list[dict]) -> dict:
    support_strength = sum(signal.get("confidenceScore", 0) for signal in supporting[:3])
    conflict_strength = sum(signal.get("confidenceScore", 0) for signal in conflicting[:3])
    trend_score = 50 + support_strength // 12 - conflict_strength // 14
    if regime.get("regime") == "risk-on":
        trend_score += 8
    elif regime.get("regime") == "risk-off":
        trend_score -= 8
    trend_score = max(20, min(88, trend_score))

    if asset.asset_key in {"equity", "tactical", "crypto"}:
        buy_zone = "Use staggered entries near prior support or after a confirmed breakout; avoid chasing vertical moves."
        stop = "Review or reduce if price breaks the latest support zone with weak volume recovery."
        target = "Use a review zone rather than a fixed target; reassess after 8-12 weeks or a sharp move."
    elif asset.asset_key == "gold":
        buy_zone = "Accumulate gradually on pullbacks or planned monthly dates."
        stop = "No hard stop for hedge allocation; trim if it grows beyond target allocation."
        target = "Review every 6 months or after macro risk cools."
    else:
        buy_zone = "Use planned monthly allocation; market timing is less important than liquidity and credit quality."
        stop = "Exit if credit quality, liquidity, or linked-goal need changes."
        target = "Review monthly until goal funding is on track."

    return {
        "technicalScore": trend_score,
        "priceTrend": "Improving" if trend_score >= 65 else "Weak" if trend_score <= 42 else "Mixed",
        "buyZone": buy_zone,
        "supportZone": "Use recent swing support or SIP dates; exact live support needs current chart verification.",
        "resistanceZone": "Use prior highs or valuation-driven review levels; not a promised target.",
        "stopLossReference": stop,
        "reviewZone": target,
        "dataMode": "limited",
    }


def calculate_technical_indicators(asset: dict, price_history: dict) -> dict:
    closes = [float(value) for value in price_history.get("closes", []) if isinstance(value, (int, float))]
    volumes = [float(value) for value in price_history.get("volumes", []) if isinstance(value, (int, float))]
    source_url = price_history.get("sourceUrl", "")
    mode = price_history.get("dataMode", "limited")
    if len(closes) < 30:
        return _limited_technical(asset, mode, source_url)

    latest = closes[-1]
    ma20 = _ma(closes, 20)
    ma50 = _ma(closes, 50)
    ma200 = _ma(closes, 200)
    rsi = _rsi(closes, 14)
    macd = _ema(closes, 12) - _ema(closes, 26) if len(closes) >= 26 else None
    support = min(closes[-20:])
    resistance = max(closes[-20:])
    drawdown = ((latest - max(closes)) / max(closes)) * 100 if max(closes) else 0
    returns = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes)) if closes[i - 1]]
    volatility = min(100, round((sqrt(mean([(value - mean(returns)) ** 2 for value in returns[-60:]])) if returns else 0) * 1000))
    relative_strength = 50
    if len(closes) >= 60 and closes[-60]:
        relative_strength = max(5, min(95, round(50 + ((latest - closes[-60]) / closes[-60]) * 180)))
    trend_strength = _trend_strength(latest, ma20, ma50, ma200, rsi)
    breakout = "breakout watch" if latest > resistance * 0.98 and trend_strength >= 65 else "breakdown risk" if latest < support * 1.02 and trend_strength <= 42 else "range-bound"
    volume_spike = _volume_spike(volumes)
    buy_low = support * 1.01
    buy_high = min(latest, support * 1.07)
    review_low = resistance * 0.98
    review_high = resistance * 1.06
    stop = support * 0.94
    return {
        "assetName": asset["name"],
        "ticker": asset.get("ticker", ""),
        "latestPrice": round(latest, 2),
        "movingAverage20": _round(ma20),
        "movingAverage50": _round(ma50),
        "movingAverage200": _round(ma200),
        "rsi": _round(rsi),
        "macd": _round(macd),
        "volumeSpike": volume_spike,
        "relativeStrength": relative_strength,
        "volatility": volatility,
        "supportZone": _range(support * 0.98, support * 1.02),
        "resistanceZone": _range(resistance * 0.98, resistance * 1.02),
        "breakoutStatus": breakout,
        "trendStrength": trend_strength,
        "drawdown": round(drawdown, 2),
        "buyRange": _range(buy_low, buy_high),
        "reviewZone": _range(review_low, review_high),
        "stopLossReference": f"Review if price sustains below {_round(stop)}; this is a risk reference, not a guaranteed stop.",
        "confidenceScore": 76 if mode in {"live", "cached", "delayed"} else 52,
        "dataMode": mode,
        "sourceUrl": source_url,
    }


def _limited_technical(asset: dict, mode: str, source_url: str) -> dict:
    return {
        "assetName": asset["name"],
        "ticker": asset.get("ticker", ""),
        "latestPrice": None,
        "movingAverage20": None,
        "movingAverage50": None,
        "movingAverage200": None,
        "rsi": None,
        "macd": None,
        "volumeSpike": "limited data",
        "relativeStrength": 50,
        "volatility": 65 if asset.get("assetClass") == "crypto" else 50,
        "supportZone": "limited data",
        "resistanceZone": "limited data",
        "breakoutStatus": "limited data",
        "trendStrength": 45,
        "drawdown": None,
        "buyRange": "Use staggered entries only after live chart verification.",
        "reviewZone": "Review after more price history is available.",
        "stopLossReference": "No precise stop; data is limited.",
        "confidenceScore": 35,
        "dataMode": mode,
        "sourceUrl": source_url,
    }


def _ma(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return mean(values[-window:])


def _ema(values: list[float], window: int) -> float:
    multiplier = 2 / (window + 1)
    ema = values[0]
    for value in values[1:]:
        ema = (value - ema) * multiplier + ema
    return ema


def _rsi(values: list[float], window: int) -> float | None:
    if len(values) <= window:
        return None
    gains = []
    losses = []
    for index in range(-window, 0):
        change = values[index] - values[index - 1]
        gains.append(max(change, 0))
        losses.append(abs(min(change, 0)))
    avg_gain = mean(gains)
    avg_loss = mean(losses)
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _trend_strength(latest: float, ma20: float | None, ma50: float | None, ma200: float | None, rsi: float | None) -> int:
    score = 50
    if ma20 and latest > ma20:
        score += 10
    if ma50 and latest > ma50:
        score += 10
    if ma200 and latest > ma200:
        score += 10
    if ma20 and ma50 and ma20 > ma50:
        score += 8
    if rsi and 45 <= rsi <= 68:
        score += 8
    if rsi and rsi > 75:
        score -= 8
    return max(5, min(95, score))


def _volume_spike(volumes: list[float]) -> str:
    if len(volumes) < 30:
        return "limited data"
    recent = mean(volumes[-5:])
    base = mean(volumes[-30:-5])
    if not base:
        return "limited data"
    ratio = recent / base
    if ratio >= 1.8:
        return "strong volume spike"
    if ratio >= 1.25:
        return "moderate volume pickup"
    return "normal volume"


def _range(low: float, high: float) -> str:
    return f"{_round(low)} - {_round(high)}"


def _round(value: float | None) -> float | None:
    return round(value, 2) if isinstance(value, (int, float)) else None
