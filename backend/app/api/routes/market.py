from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.intelligence_compression_agent import compress_market_signal
from app.agents.research_intelligence_agent import refresh_research
from app.core.database import get_db
from app.services.cache.intelligence_cache import clear_cache_namespace, get_cached, set_cached
from app.services.llm.background_enhancement_service import hydrate_and_schedule_market_signals
from app.services.market.signal_intelligence_service import impact_map_list, latest_market_regime, market_signal_detail, market_signal_list, refresh_signal_intelligence

router = APIRouter()


@router.get("/regime")
def regime(db: Session = Depends(get_db)) -> dict:
    cached = get_cached("market", "regime")
    if cached:
        return {**cached, "cacheStatus": "cached"}
    result = latest_market_regime(db)
    set_cached("market", "regime", result, ttl_seconds=180)
    return result


@router.get("/signals")
def signals(db: Session = Depends(get_db)) -> list[dict]:
    cached = get_cached("market", "signals")
    if cached:
        return hydrate_and_schedule_market_signals(cached)
    rows = market_signal_list(db, limit=16, llm_enhance_count=0)
    if not rows:
        refresh_research(db)
        refresh_signal_intelligence(db)
        rows = market_signal_list(db, limit=16, llm_enhance_count=0)
    compressed = [compress_market_signal(row) for row in rows]
    hydrated = hydrate_and_schedule_market_signals(compressed)
    set_cached("market", "signals", hydrated, ttl_seconds=180)
    return hydrated


@router.post("/signals/refresh-copy")
def refresh_signal_copies(db: Session = Depends(get_db)) -> list[dict]:
    clear_cache_namespace("market")
    rows = market_signal_list(db, limit=16, llm_enhance_count=0)
    if not rows:
        refresh_research(db)
        refresh_signal_intelligence(db)
        rows = market_signal_list(db, limit=16, llm_enhance_count=0)
    compressed = [compress_market_signal(row) for row in rows]
    hydrated = hydrate_and_schedule_market_signals(compressed, force=True)
    set_cached("market", "signals", hydrated, ttl_seconds=180)
    return hydrated


@router.get("/signals/{signal_id}")
def signal_detail(signal_id: int, db: Session = Depends(get_db)) -> dict:
    row = market_signal_detail(db, signal_id)
    if not row:
        raise HTTPException(status_code=404, detail="Market signal not found")
    return hydrate_and_schedule_market_signals([compress_market_signal(row)])[0]


@router.post("/signals/{signal_id}/refresh-copy")
def refresh_signal_copy(signal_id: int, db: Session = Depends(get_db)) -> dict:
    clear_cache_namespace("market")
    row = market_signal_detail(db, signal_id)
    if not row:
        raise HTTPException(status_code=404, detail="Market signal not found")
    return hydrate_and_schedule_market_signals([compress_market_signal(row)], force=True)[0]


@router.get("/impact-map")
def impact_map(db: Session = Depends(get_db)) -> list[dict]:
    return impact_map_list(db)


@router.post("/refresh-intelligence")
def refresh_intelligence(db: Session = Depends(get_db)) -> dict:
    clear_cache_namespace("market")
    clear_cache_namespace("recommendations")
    refresh_result = refresh_research(db, force=True)
    intelligence_result = refresh_signal_intelligence(db, force=True)
    return {
        "status": "refreshed",
        "research": refresh_result,
        "intelligence": intelligence_result,
    }
