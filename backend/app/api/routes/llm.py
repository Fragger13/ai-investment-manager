from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.agents.intelligence_compression_agent import compress_market_signal
from app.api.routes.recommendations import latest as latest_recommendations
from app.core.database import get_db
from app.services.assets.asset_intelligence_service import asset_research
from app.services.llm.background_enhancement_service import (
    enhancement_queue_status,
    hydrate_and_schedule_assets,
    hydrate_and_schedule_market_signals,
    hydrate_and_schedule_recommendations,
)
from app.services.llm.enhancement_persistence_service import enhancement_status_snapshot
from app.services.llm.model_router import summarize_text
from app.services.llm_usage import is_dev_environment
from app.services.market.signal_intelligence_service import market_signal_list

router = APIRouter()


@router.post("/summarize")
def summarize(payload: dict = Body(...)) -> dict:
    """On-demand LLM rewrite that turns verbose copy into one short sentence.

    Used by the frontend to optionally re-render an over-long description.
    Returns the original text unchanged when the LLM is disabled or fails.
    """
    text = str(payload.get("text", ""))
    max_words = int(payload.get("maxWords", 30) or 30)
    fallback = str(payload.get("fallback") or text)
    summary = summarize_text(text, max_words=max_words, fallback=fallback)
    return {"summary": summary}


@router.get("/enhancement-status")
def enhancement_status(
    itemType: str | None = Query(default=None),
    details: bool = Query(default=False),
) -> dict:
    include_items = details and is_dev_environment()
    return {
        **enhancement_status_snapshot(itemType, include_items=include_items),
        "runtime": enhancement_queue_status(),
    }


@router.post("/enhance/recommendations")
def enhance_recommendations(force: bool = Query(default=True), db: Session = Depends(get_db)) -> dict:
    result = latest_recommendations(db)
    items = hydrate_and_schedule_recommendations(result.get("recommendations", []), force=force)
    return _queued_response("recommendation", items)


@router.post("/enhance/market")
def enhance_market(force: bool = Query(default=True), db: Session = Depends(get_db)) -> dict:
    items = [compress_market_signal(item) for item in market_signal_list(db, limit=16, llm_enhance_count=0)]
    return _queued_response("market", hydrate_and_schedule_market_signals(items, force=force))


@router.post("/enhance/assets")
def enhance_assets(force: bool = Query(default=True), db: Session = Depends(get_db)) -> dict:
    return _queued_response("asset", hydrate_and_schedule_assets(asset_research(db), force=force))


@router.post("/enhance/all")
def enhance_all(force: bool = Query(default=True), db: Session = Depends(get_db)) -> dict:
    recommendation_result = latest_recommendations(db)
    recommendations = hydrate_and_schedule_recommendations(recommendation_result.get("recommendations", []), force=force)
    market = [compress_market_signal(item) for item in market_signal_list(db, limit=16, llm_enhance_count=0)]
    assets = asset_research(db)
    return {
        "status": "queued",
        "recommendations": _queued_response("recommendation", recommendations),
        "market": _queued_response("market", hydrate_and_schedule_market_signals(market, force=force)),
        "assets": _queued_response("asset", hydrate_and_schedule_assets(assets, force=force)),
    }


def _queued_response(item_type: str, items: list[dict]) -> dict:
    return {
        "status": "queued",
        "itemType": item_type,
        "itemCount": len(items),
        "pendingCount": sum(bool(item.get("llm_enhancement_pending") or item.get("llmEnhancementPending")) for item in items),
    }
