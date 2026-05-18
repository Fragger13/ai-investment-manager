from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.research_intelligence_agent import refresh_research
from app.core.database import get_db
from app.models.asset_research import AssetResearch
from app.models.market_signal import MarketSignal
from app.models.research_article import ResearchArticle
from app.models.research_source import ResearchSource
from app.models.source_refresh_log import SourceRefreshLog
from app.schemas.research import AssetResearchResponse, MarketSignalResponse, ResearchRefreshRequest, ResearchRefreshResponse, ResearchSourceResponse
from app.services.research.source_cache_service import seed_sources
from app.services.research.source_registry import source_registry

router = APIRouter()


def _loads(value: str) -> list:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return []


def signal_to_response(signal: MarketSignal) -> MarketSignalResponse:
    return MarketSignalResponse(
        id=signal.id,
        title=signal.summary[:90],
        summary=signal.summary,
        signalType=signal.signal_type,
        sentiment=signal.sentiment,
        assetClasses=_loads(signal.asset_classes),
        instruments=_loads(signal.instruments),
        sectors=_loads(signal.sectors),
        macroThemes=_loads(signal.macro_themes),
        riskSignals=_loads(signal.risk_signals),
        opportunitySignals=_loads(signal.opportunity_signals),
        relevanceScore=signal.relevance_score,
        credibilityScore=signal.credibility_score,
        confidenceScore=signal.confidence_score,
        sourceName=signal.source_name,
        sourceUrl=signal.source_url,
        publishedAt=signal.published_at,
        retrievedAt=signal.retrieved_at,
        dataMode=signal.data_mode,
    )


def asset_to_response(asset: AssetResearch) -> AssetResearchResponse:
    return AssetResearchResponse(
        id=asset.id,
        instrumentName=asset.instrument_name,
        assetType=asset.asset_type,
        category=asset.category,
        summary=asset.summary,
        suitabilityNotes=asset.suitability_notes,
        riskNotes=asset.risk_notes,
        evidence=_loads(asset.evidence_json),
        dataMode=asset.data_mode,
        confidenceScore=asset.confidence_score,
        retrievedAt=asset.retrieved_at,
    )


@router.post("/refresh", response_model=ResearchRefreshResponse)
def refresh(payload: ResearchRefreshRequest, db: Session = Depends(get_db)) -> dict:
    return refresh_research(db, force=payload.force)


@router.get("/sources", response_model=list[ResearchSourceResponse])
def sources(db: Session = Depends(get_db)) -> list[ResearchSourceResponse]:
    registry = source_registry()
    seed_sources(db, registry)
    current_names = {source.source_name for source in registry}
    rows = db.query(ResearchSource).filter(ResearchSource.source_name.in_(current_names)).order_by(ResearchSource.reliability_score.desc()).all()
    latest_logs = {}
    for log in db.query(SourceRefreshLog).order_by(SourceRefreshLog.id.desc()).all():
        latest_logs.setdefault(log.source_name, log.mode)
    return [
        ResearchSourceResponse(
            id=row.id,
            sourceName=row.source_name,
            sourceType=row.source_type,
            baseUrl=row.base_url,
            reliabilityScore=row.reliability_score,
            allowedIngestionMethod=row.allowed_ingestion_method,
            refreshFrequency=row.refresh_frequency,
            categoriesCovered=_loads(row.categories_covered),
            enabled=row.enabled,
            dataMode=latest_logs.get(row.source_name, "fallback" if row.allowed_ingestion_method != "api_key" else "limited"),
        )
        for row in rows
    ]


@router.get("/signals", response_model=list[MarketSignalResponse])
def signals(db: Session = Depends(get_db)) -> list[MarketSignalResponse]:
    rows = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(50).all()
    if not rows:
        refresh_research(db)
        rows = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).limit(50).all()
    unique_rows = []
    seen = set()
    for row in rows:
        key = (row.source_url, row.signal_type, row.summary)
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(row)
    return [signal_to_response(row) for row in unique_rows]


@router.get("/assets", response_model=list[AssetResearchResponse])
def assets(db: Session = Depends(get_db)) -> list[AssetResearchResponse]:
    rows = db.query(AssetResearch).order_by(AssetResearch.retrieved_at.desc()).limit(50).all()
    if not rows:
        refresh_research(db)
        rows = db.query(AssetResearch).order_by(AssetResearch.retrieved_at.desc()).limit(50).all()
    unique_rows = []
    seen = set()
    for row in rows:
        if row.instrument_name in seen:
            continue
        seen.add(row.instrument_name)
        unique_rows.append(row)
    live_or_cached = [row for row in unique_rows if row.data_mode in {"live", "cached", "delayed"}]
    if live_or_cached:
        unique_rows = live_or_cached
    return [asset_to_response(row) for row in unique_rows]


@router.get("/status")
def status(db: Session = Depends(get_db)) -> dict:
    current_source_names = {source.source_name for source in source_registry()}
    logs = db.query(SourceRefreshLog).filter(SourceRefreshLog.source_name.in_(current_source_names)).order_by(SourceRefreshLog.id.desc()).limit(20).all()
    latest_signal = db.query(MarketSignal).order_by(MarketSignal.retrieved_at.desc()).first()
    latest_article = db.query(ResearchArticle).order_by(ResearchArticle.retrieved_at.desc()).first()
    latest_retrieved_at = logs[0].retrieved_at if logs else ""
    latest_dt = _parse_iso(latest_retrieved_at)
    current_logs = []
    for log in logs:
        log_dt = _parse_iso(log.retrieved_at)
        if latest_dt and log_dt and abs((latest_dt - log_dt).total_seconds()) <= 120:
            current_logs.append(log)
    mode = "fallback"
    if any(log.mode == "live" for log in current_logs):
        mode = "live"
    elif any(log.mode == "cached" for log in current_logs):
        mode = "cached"
    elif any(log.mode == "delayed" for log in current_logs):
        mode = "delayed"
    elif any(log.mode == "limited" for log in current_logs):
        mode = "limited"
    return {
        "status": "ready" if logs else "not_refreshed",
        "dataMode": mode,
        "latestRetrievedAt": latest_retrieved_at,
        "latestSignalAt": latest_signal.retrieved_at if latest_signal else "",
        "latestArticleAt": latest_article.retrieved_at if latest_article else "",
        "sourceCount": len(source_registry()),
        "signalCount": db.query(MarketSignal).count(),
        "articleCount": db.query(ResearchArticle).count(),
        "assetCount": db.query(AssetResearch).count(),
        "logs": [
            {
                "sourceName": log.source_name,
                "status": log.status,
                "mode": log.mode,
                "message": log.message,
                "retrievedAt": log.retrieved_at,
                "itemsProcessed": log.items_processed,
            }
            for log in current_logs
        ],
    }


def _parse_iso(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
