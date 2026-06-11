from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.asset_signal_link import AssetSignalLink
from app.models.evidence_item import EvidenceItem
from app.models.market_signal import MarketSignal
from app.models.recommendation_evidence_link import RecommendationEvidenceLink
from app.models.signal_evidence_link import SignalEvidenceLink
from app.models.source_reliability_score import SourceReliabilityScore
from app.services.intelligence import now_iso


def upsert_evidence_item(db: Session, payload: dict) -> EvidenceItem:
    source_url = payload.get("sourceUrl", "")
    title = payload.get("title", payload.get("summary", ""))[:500]
    existing = (
        db.query(EvidenceItem)
        .filter(EvidenceItem.source_url == source_url)
        .filter(EvidenceItem.title == title)
        .first()
        if source_url
        else None
    )
    if existing:
        existing.credibility_score = payload.get("credibilityScore", existing.credibility_score)
        existing.relevance_score = payload.get("relevanceScore", existing.relevance_score)
        existing.recency_score = payload.get("recencyScore", existing.recency_score)
        existing.confidence_contribution = payload.get("confidenceContribution", existing.confidence_contribution)
        existing.data_mode = payload.get("dataMode", existing.data_mode)
        existing.retrieved_at = payload.get("retrievedAt", existing.retrieved_at)
        return existing
    record = EvidenceItem(
        source_name=payload.get("sourceName", "Unknown source"),
        source_url=source_url,
        evidence_type=payload.get("signalType", payload.get("evidenceType", "market_signal")),
        title=title,
        summary=payload.get("summary", ""),
        raw_text_allowed=payload.get("rawTextAllowed", "no"),
        credibility_score=payload.get("credibilityScore", 50),
        relevance_score=payload.get("relevanceScore", 50),
        recency_score=payload.get("recencyScore", 50),
        confidence_contribution=payload.get("confidenceContribution", payload.get("confidenceScore", 50)),
        data_mode=payload.get("dataMode", "limited"),
        retrieved_at=payload.get("retrievedAt", now_iso()),
    )
    db.add(record)
    db.flush()
    return record


def save_signal_evidence_links(db: Session, signals: list[MarketSignal]) -> None:
    for signal in signals:
        evidence = upsert_evidence_item(
            db,
            {
                "sourceName": signal.source_name,
                "sourceUrl": signal.source_url,
                "signalType": signal.signal_type,
                "title": signal.summary[:140],
                "summary": signal.summary,
                "credibilityScore": signal.credibility_score,
                "relevanceScore": signal.relevance_score,
                "confidenceScore": signal.confidence_score,
                "confidenceContribution": signal.confidence_score,
                "dataMode": signal.data_mode,
                "retrievedAt": signal.retrieved_at,
            },
        )
        if not _signal_evidence_exists(db, signal.id, evidence.id):
            db.add(SignalEvidenceLink(signal_id=signal.id, evidence_id=evidence.id, link_type="supporting"))
        for asset_name in _signal_assets(signal):
            if not _asset_signal_exists(db, asset_name, signal.id):
                db.add(AssetSignalLink(asset_name=asset_name, asset_type=signal.signal_type, signal_id=signal.id, relationship="mentioned"))
    db.commit()


def link_recommendation_evidence(db: Session, recommendation_id: int, recommendation: dict) -> None:
    evidence_payloads = recommendation.get("evidencePoints") or recommendation.get("evidence") or []
    source_links = recommendation.get("sourceLinks", [])
    if not evidence_payloads and source_links:
        evidence_payloads = [
            {
                "sourceName": source.get("name", "Unknown source"),
                "sourceUrl": source.get("url", ""),
                "signalType": source.get("supportType", "supporting"),
                "summary": source.get("summary", recommendation.get("whyThisMatters", "")),
                "credibilityScore": source.get("credibilityScore", 50),
                "relevanceScore": recommendation.get("suitabilityScore", 50),
                "confidenceContribution": recommendation.get("confidenceScore", 50),
                "dataMode": recommendation.get("dataMode", "limited"),
                "retrievedAt": source.get("retrievedAt", recommendation.get("dataTimestamp", now_iso())),
            }
            for source in source_links
        ]
    for item in evidence_payloads:
        evidence = upsert_evidence_item(
            db,
            {
                "sourceName": item.get("sourceName", item.get("source", "Unknown source")),
                "sourceUrl": item.get("sourceUrl", item.get("url", "")),
                "signalType": item.get("signalType", "recommendation_evidence"),
                "title": item.get("title", item.get("summary", ""))[:140],
                "summary": item.get("summary", item.get("text", "")),
                "credibilityScore": item.get("credibilityScore", 50),
                "relevanceScore": item.get("relevanceScore", 50),
                "recencyScore": item.get("recencyScore", 50),
                "confidenceContribution": item.get("confidenceContribution", item.get("confidence", 50)),
                "dataMode": item.get("dataMode", recommendation.get("dataMode", "limited")),
                "retrievedAt": item.get("timestamp", item.get("retrievedAt", recommendation.get("dataTimestamp", now_iso()))),
            },
        )
        if not _recommendation_evidence_exists(db, recommendation_id, evidence.id):
            db.add(RecommendationEvidenceLink(recommendation_id=recommendation_id, evidence_id=evidence.id, link_type="supporting"))
    db.commit()


def save_source_reliability_scores(db: Session, scores: list[dict]) -> None:
    for score in scores:
        db.add(
            SourceReliabilityScore(
                source_name=score["sourceName"],
                reliability_score=score.get("reliabilityScore", 50),
                bias_risk_score=score.get("biasRiskScore", 30),
                freshness_score=score.get("freshnessScore", 50),
                availability_score=score.get("availabilityScore", 50),
                final_reliability_score=score.get("finalReliabilityScore", 50),
                data_mode=score.get("dataMode", "limited"),
                message=score.get("message", ""),
                retrieved_at=score.get("retrievedAt", now_iso()),
            )
        )
    db.commit()


def _signal_evidence_exists(db: Session, signal_id: int, evidence_id: int) -> bool:
    return bool(db.query(SignalEvidenceLink).filter(SignalEvidenceLink.signal_id == signal_id, SignalEvidenceLink.evidence_id == evidence_id).first())


def _recommendation_evidence_exists(db: Session, recommendation_id: int, evidence_id: int) -> bool:
    return bool(
        db.query(RecommendationEvidenceLink)
        .filter(RecommendationEvidenceLink.recommendation_id == recommendation_id, RecommendationEvidenceLink.evidence_id == evidence_id)
        .first()
    )


def _asset_signal_exists(db: Session, asset_name: str, signal_id: int) -> bool:
    return bool(db.query(AssetSignalLink).filter(AssetSignalLink.asset_name == asset_name, AssetSignalLink.signal_id == signal_id).first())


def _signal_assets(signal: MarketSignal) -> list[str]:
    import json

    assets: list[str] = []
    for value in [signal.instruments, signal.sectors, signal.asset_classes]:
        try:
            assets.extend(json.loads(value))
        except json.JSONDecodeError:
            continue
    return sorted({asset for asset in assets if asset})[:10]
