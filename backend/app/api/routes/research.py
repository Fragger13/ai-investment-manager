from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.research_intelligence_agent import refresh_research
from app.core.database import get_db
from app.models.asset_research import AssetResearch
from app.models.evidence_item import EvidenceItem
from app.models.market_signal import MarketSignal
from app.models.research_article import ResearchArticle
from app.models.signal_evidence_link import SignalEvidenceLink
from app.models.source_refresh_log import SourceRefreshLog
from app.schemas.research import AssetResearchResponse, MarketSignalResponse, ResearchRefreshRequest, ResearchRefreshResponse, ResearchSourceResponse
from app.agents.market_intelligence_engine import transform_market_signal
from app.services.research.source_registry import source_registry
from app.services.research.source_registry_v2 import source_registry_v2

router = APIRouter()


def _loads(value: str) -> list:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return []


def signal_to_response(signal: MarketSignal, db: Session | None = None) -> MarketSignalResponse:
    evidence_rows = []
    if signal.id and db is not None:
        evidence_rows = (
            db.query(EvidenceItem)
            .join(SignalEvidenceLink, SignalEvidenceLink.evidence_id == EvidenceItem.id)
            .filter(SignalEvidenceLink.signal_id == signal.id)
            .limit(5)
            .all()
        )
    transformed = transform_market_signal(
        {
            "id": signal.id,
            "title": signal.summary[:90],
            "summary": signal.summary,
            "signalType": signal.signal_type,
            "sentiment": signal.sentiment,
            "assetClasses": _loads(signal.asset_classes),
            "instruments": _loads(signal.instruments),
            "sectors": _loads(signal.sectors),
            "macroThemes": _loads(signal.macro_themes),
            "riskSignals": _loads(signal.risk_signals),
            "opportunitySignals": _loads(signal.opportunity_signals),
            "relevanceScore": signal.relevance_score,
            "credibilityScore": signal.credibility_score,
            "confidenceScore": signal.confidence_score,
            "sourceName": signal.source_name,
            "sourceUrl": signal.source_url,
            "publishedAt": signal.published_at,
            "retrievedAt": signal.retrieved_at,
            "dataMode": signal.data_mode,
        }
    )
    return MarketSignalResponse(
        id=signal.id,
        title=transformed["title"],
        summary=transformed["summary"],
        signalType=transformed["signalType"],
        sentiment=transformed["sentiment"],
        assetClasses=transformed["assetClasses"],
        instruments=transformed["instruments"],
        sectors=transformed["sectors"],
        macroThemes=transformed["macroThemes"],
        riskSignals=transformed["riskSignals"],
        opportunitySignals=transformed["opportunitySignals"],
        relevanceScore=signal.relevance_score,
        credibilityScore=signal.credibility_score,
        confidenceScore=signal.confidence_score,
        sourceName=signal.source_name,
        sourceUrl=signal.source_url,
        publishedAt=signal.published_at,
        retrievedAt=signal.retrieved_at,
        dataMode=signal.data_mode,
        relatedRecommendation=transformed.get("relatedRecommendation"),
        signalCategory=transformed["signalCategory"],
        affectedAssets=transformed["affectedAssets"],
        likelyBeneficiaries=transformed["likelyBeneficiaries"],
        likelyLosers=transformed["likelyLosers"],
        whyItMatters=transformed["whyItMatters"],
        userRelevance=transformed["userRelevance"],
        portfolioRelevance=transformed["portfolioRelevance"],
        impactScore=transformed["impactScore"],
        sourceCount=len({row.source_url or row.source_name for row in evidence_rows}) or 1,
        evidence=[
            {
                "sourceName": row.source_name,
                "sourceUrl": row.source_url,
                "summary": row.summary,
                "signalType": row.evidence_type,
                "credibilityScore": row.credibility_score,
                "confidenceContribution": row.confidence_contribution,
                "dataMode": row.data_mode,
                "retrievedAt": row.retrieved_at,
            }
            for row in evidence_rows
        ],
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
    registry = source_registry_v2()
    latest_logs = {}
    for log in db.query(SourceRefreshLog).order_by(SourceRefreshLog.id.desc()).all():
        latest_logs.setdefault(log.source_name, log.mode)
    return [
        ResearchSourceResponse(
            id=None,
            sourceName=source.source_name,
            sourceType=source.source_type,
            baseUrl=source.base_url,
            reliabilityScore=source.reliability_score,
            allowedIngestionMethod=source.ingestion_method,
            refreshFrequency=source.refresh_frequency,
            categoriesCovered=source.market_coverage + source.asset_coverage,
            enabled=source.enabled and source.allowed,
            dataMode=latest_logs.get(source.source_name, "limited" if source.requires_api_key else "fallback"),
        )
        for source in sorted(registry, key=lambda item: item.reliability_score, reverse=True)
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
    return [signal_to_response(row, db) for row in unique_rows]


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
    current_source_names = {source.source_name for source in source_registry()} | {source.source_name for source in source_registry_v2()}
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
        "sourceCount": len(current_source_names),
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


def _signal_category(signal_type: str, macro_themes: list[str], sectors: list[str], summary: str) -> str:
    text = f"{signal_type} {' '.join(macro_themes)} {' '.join(sectors)} {summary}".lower()
    if "crypto" in text:
        return "Crypto"
    if any(term in text for term in ["war", "geopolitical", "border", "sanction"]):
        return "Geopolitical"
    if any(term in text for term in ["rbi", "rate", "repo", "inflation", "liquidity"]):
        return "Macro"
    if any(term in text for term in ["budget", "policy", "sebi", "tax"]):
        return "Policy"
    if any(term in text for term in ["earnings", "profit", "revenue", "margin"]):
        return "Earnings"
    if any(term in text for term in ["breakout", "volume", "technical", "trend"]):
        return "Technical"
    if sectors:
        return "Sector"
    if any(term in text for term in ["gold", "oil", "crude", "commodity"]):
        return "Commodity"
    if any(term in text for term in ["rupee", "currency", "dollar"]):
        return "Currency"
    return "Sentiment" if signal_type == "market trend" else signal_type.title()


def _beneficiaries_and_losers(summary: str, sectors: list[str], macro_themes: list[str]) -> tuple[list[str], list[str]]:
    text = f"{summary} {' '.join(sectors)} {' '.join(macro_themes)}".lower()
    beneficiaries = set(sectors)
    losers = set()
    if any(term in text for term in ["rate", "repo", "liquidity"]):
        beneficiaries.update(["banking", "NBFC", "real estate", "auto"])
    if any(term in text for term in ["infra", "budget", "capex"]):
        beneficiaries.update(["capital goods", "cement", "steel", "construction"])
    if any(term in text for term in ["war", "geopolitical", "oil"]):
        beneficiaries.update(["gold", "defence", "energy"])
        losers.update(["airlines", "paint", "chemicals"])
    if any(term in text for term in ["rupee", "currency", "dollar"]):
        beneficiaries.update(["IT", "pharma", "exporters"])
        losers.update(["import-heavy sectors"])
    return sorted(beneficiaries)[:6], sorted(losers)[:5]


def _clean_headline(summary: str, signal_type: str, sectors: list[str], macro_themes: list[str]) -> str:
    text = summary.strip()
    lower = text.lower()
    if "rbi" in lower or "repo" in lower or "rate" in lower:
        return "Rate and liquidity signals may affect banks, NBFCs, and real estate"
    if "infra" in lower or "capex" in lower or "budget" in lower:
        return "Infrastructure spending signals may support capital goods and construction"
    if "gold" in lower:
        return "Gold signals point to a possible hedge against macro uncertainty"
    if "crypto" in lower or "bitcoin" in lower or "ethereum" in lower:
        return "Crypto signals remain tactical and high-risk"
    if sectors:
        return f"{sectors[0].title()} signal: {_short_title(text)}"
    return _short_title(text or signal_type.title())


def _short_title(value: str) -> str:
    value = " ".join(value.split())
    return value[:88].rstrip() + ("..." if len(value) > 88 else "")
