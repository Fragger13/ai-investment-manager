from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models.asset_research import AssetResearch
from app.models.market_signal import MarketSignal
from app.models.recommendation import RecommendationRecord
from app.models.recommendation_source import RecommendationSource
from app.models.research_article import ResearchArticle
from app.models.research_source import ResearchSource
from app.models.source_refresh_log import SourceRefreshLog
from app.services.evidence.evidence_graph_service import link_recommendation_evidence
from app.services.intelligence import now_iso
from app.services.research.source_registry import SourceDefinition


def seed_sources(db: Session, sources: list[SourceDefinition]) -> None:
    for source in sources:
        existing = db.query(ResearchSource).filter(ResearchSource.source_name == source.source_name).first()
        payload = {
            "source_type": source.source_type,
            "base_url": source.base_url,
            "reliability_score": source.reliability_score,
            "allowed_ingestion_method": source.allowed_ingestion_method,
            "refresh_frequency": source.refresh_frequency,
            "categories_covered": json.dumps(source.categories_covered),
            "enabled": source.enabled,
        }
        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(ResearchSource(source_name=source.source_name, **payload))
    db.commit()


def save_articles(db: Session, articles: list[dict]) -> list[ResearchArticle]:
    saved = []
    for article in articles:
        if not article.get("sourceUrl"):
            article["sourceUrl"] = f"{article['sourceName']}::{article['title']}"
        existing = db.query(ResearchArticle).filter(ResearchArticle.source_url == article["sourceUrl"]).first()
        if existing:
            saved.append(existing)
            continue
        record = ResearchArticle(
            source_name=article["sourceName"],
            source_url=article["sourceUrl"],
            title=article["title"],
            summary=article.get("summary", ""),
            raw_text=article.get("rawText", ""),
            published_at=article.get("publishedAt", ""),
            retrieved_at=article.get("retrievedAt", now_iso()),
            credibility_score=article.get("credibilityScore", 50),
            extraction_mode=article.get("extractionMode", "fallback"),
        )
        db.add(record)
        db.flush()
        saved.append(record)
    db.commit()
    return saved


def save_signals(db: Session, signals: list[dict]) -> list[MarketSignal]:
    saved = []
    for signal in signals:
        summary = signal.get("summary", signal.get("title", ""))
        existing = (
            db.query(MarketSignal)
            .filter(MarketSignal.source_url == signal.get("sourceUrl", ""))
            .filter(MarketSignal.signal_type == signal["signalType"])
            .filter(MarketSignal.summary == summary)
            .first()
        )
        if existing:
            existing.retrieved_at = signal.get("retrievedAt", existing.retrieved_at)
            existing.confidence_score = signal.get("confidenceScore", existing.confidence_score)
            saved.append(existing)
            continue
        record = MarketSignal(
            signal_type=signal["signalType"],
            sentiment=signal["sentiment"],
            asset_classes=json.dumps(signal.get("assetClasses", [])),
            instruments=json.dumps(signal.get("instruments", [])),
            sectors=json.dumps(signal.get("sectors", [])),
            macro_themes=json.dumps(signal.get("macroThemes", [])),
            risk_signals=json.dumps(signal.get("riskSignals", [])),
            opportunity_signals=json.dumps(signal.get("opportunitySignals", [])),
            summary=summary,
            source_url=signal.get("sourceUrl", ""),
            source_name=signal.get("sourceName", ""),
            published_at=signal.get("publishedAt", ""),
            retrieved_at=signal.get("retrievedAt", now_iso()),
            relevance_score=signal.get("relevanceScore", 50),
            credibility_score=signal.get("credibilityScore", 50),
            confidence_score=signal.get("confidenceScore", 50),
            data_mode=signal.get("dataMode", "fallback"),
        )
        db.add(record)
        db.flush()
        saved.append(record)
    db.commit()
    return saved


def save_assets(db: Session, assets: list[dict]) -> list[AssetResearch]:
    saved = []
    for asset in assets:
        existing = db.query(AssetResearch).filter(AssetResearch.instrument_name == asset["instrumentName"]).first()
        if existing:
            existing.asset_type = asset["assetType"]
            existing.category = asset["category"]
            existing.summary = asset["summary"]
            existing.suitability_notes = asset["suitabilityNotes"]
            existing.risk_notes = asset["riskNotes"]
            existing.evidence_json = json.dumps(asset.get("evidence", []))
            existing.return_factors_json = json.dumps(asset.get("returnFactors", {}))
            existing.data_mode = asset.get("dataMode", "fallback")
            existing.confidence_score = asset.get("confidenceScore", 50)
            existing.retrieved_at = asset.get("retrievedAt", now_iso())
            saved.append(existing)
            continue
        record = AssetResearch(
            instrument_name=asset["instrumentName"],
            asset_type=asset["assetType"],
            category=asset["category"],
            summary=asset["summary"],
            suitability_notes=asset["suitabilityNotes"],
            risk_notes=asset["riskNotes"],
            evidence_json=json.dumps(asset.get("evidence", [])),
            return_factors_json=json.dumps(asset.get("returnFactors", {})),
            data_mode=asset.get("dataMode", "fallback"),
            confidence_score=asset.get("confidenceScore", 50),
            retrieved_at=asset.get("retrievedAt", now_iso()),
        )
        db.add(record)
        db.flush()
        saved.append(record)
    db.commit()
    return saved


def log_refresh(db: Session, source_name: str, status: str, mode: str, message: str, items_processed: int) -> None:
    db.add(SourceRefreshLog(source_name=source_name, status=status, mode=mode, message=message, retrieved_at=now_iso(), items_processed=items_processed))
    db.commit()


def save_advanced_recommendation(db: Session, recommendation: dict) -> RecommendationRecord:
    record = RecommendationRecord(
        recommendation_data=json.dumps(recommendation),
        confidence_score=recommendation["confidenceScore"],
        generated_at=recommendation["dataTimestamp"],
    )
    db.add(record)
    db.flush()
    for source in recommendation.get("sourceLinks", []):
        db.add(
            RecommendationSource(
                recommendation_id=record.id,
                source_name=source["name"],
                source_url=source["url"],
                support_type=source.get("supportType", "supporting"),
                retrieved_at=source.get("retrievedAt", now_iso()),
                credibility_score=source.get("credibilityScore", 50),
            )
        )
    link_recommendation_evidence(db, record.id, recommendation)
    db.commit()
    return record
