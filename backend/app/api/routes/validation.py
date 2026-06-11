from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.recommendation import RecommendationRecord
from app.services.assets.asset_intelligence_service import asset_detail, asset_research
from app.services.backtesting.backtest_service import latest_strategy_backtests
from app.services.backtesting.benchmark_comparison_service import latest_benchmark_comparisons
from app.services.backtesting.portfolio_backtest_service import latest_portfolio_validations, validate_recommendation_portfolio
from app.services.backtesting.regime_backtest_service import latest_regime_backtests
from app.services.backtesting.signal_validation_service import latest_signal_reliability_scores, latest_signal_validations, validate_signal_reliability
from app.services.backtesting.tactical_setup_validator import validate_tactical_setup
from app.services.market.signal_intelligence_service import latest_market_regime, market_signal_list

router = APIRouter()


@router.post("/refresh")
def refresh_validation(db: Session = Depends(get_db)) -> dict:
    regime = latest_market_regime(db)
    assets = asset_research(db)[:24]
    validations = [validate_tactical_setup(db, _asset_payload(asset), regime=regime) for asset in assets]
    signals = market_signal_list(db, limit=30)
    signal_results = []
    seen = set()
    for signal in signals:
        key = (signal.get("signalType", ""), (signal.get("assetClasses") or [""])[0] if signal.get("assetClasses") else "")
        if key in seen:
            continue
        seen.add(key)
        signal_results.append(validate_signal_reliability(db, key[0] or "market signal", key[1], regime.get("regimeName", regime.get("regime", "balanced"))))
    portfolio = validate_recommendation_portfolio(db, _latest_recommendations(db))
    return {
        "status": "refreshed",
        "assetsValidated": len(validations),
        "signalsValidated": len(signal_results),
        "portfolioValidated": portfolio.get("status") != "empty",
        "averageReliability": round(sum(item.get("historicalReliability", 0) for item in validations) / len(validations)) if validations else 0,
        "weakSetups": sum(1 for item in validations if item.get("downgradeReason")),
        "regime": regime.get("regimeName", regime.get("regime", "balanced")),
        "portfolio": portfolio,
    }


@router.get("/strategies")
def strategies(db: Session = Depends(get_db)) -> list[dict]:
    return latest_strategy_backtests(db)


@router.get("/signals")
def signals(db: Session = Depends(get_db)) -> list[dict]:
    return latest_signal_validations(db)


@router.get("/reliability")
def reliability(db: Session = Depends(get_db)) -> list[dict]:
    return latest_signal_reliability_scores(db)


@router.get("/regimes")
def regimes(db: Session = Depends(get_db)) -> list[dict]:
    return latest_regime_backtests(db)


@router.get("/benchmarks")
def benchmarks(db: Session = Depends(get_db)) -> list[dict]:
    return latest_benchmark_comparisons(db)


@router.get("/portfolio")
def portfolio(db: Session = Depends(get_db)) -> list[dict]:
    rows = latest_portfolio_validations(db)
    if rows:
        return rows
    validate_recommendation_portfolio(db, _latest_recommendations(db))
    return latest_portfolio_validations(db)


@router.get("/assets/{symbol}")
def asset_validation(symbol: str, db: Session = Depends(get_db)) -> dict:
    asset = asset_detail(db, symbol)
    if not asset:
        return {"status": "not_found", "symbol": symbol}
    regime = latest_market_regime(db)
    return validate_tactical_setup(db, _asset_payload(asset), regime=regime)


def _asset_payload(asset: dict) -> dict:
    return {
        "assetName": asset.get("assetName", ""),
        "name": asset.get("assetName", ""),
        "instrumentName": asset.get("assetName", ""),
        "ticker": asset.get("ticker", ""),
        "assetType": asset.get("assetType", ""),
        "assetClass": asset.get("assetType", ""),
        "category": asset.get("category", ""),
    }


def _latest_recommendations(db: Session) -> list[dict]:
    rows = db.query(RecommendationRecord).order_by(RecommendationRecord.id.desc()).limit(80).all()
    parsed = []
    for row in rows:
        try:
            data = json.loads(row.recommendation_data)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if data.get("recommendationTitle"):
            parsed.append(data)
    if not parsed:
        return []
    timestamp = parsed[0].get("dataTimestamp", "")
    return [item for item in parsed if item.get("dataTimestamp") == timestamp]
