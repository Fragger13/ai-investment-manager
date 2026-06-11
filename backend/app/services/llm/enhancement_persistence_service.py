from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.llm_enhancement_record import LlmEnhancementRecord
from app.models.recommendation import RecommendationRecord

FINAL_STATUSES = {"completed", "failed", "fallback"}


def persisted_overlay(item_type: str, item_id: str, input_hash: str) -> dict[str, Any] | None:
    db = SessionLocal()
    try:
        record = _record(db, item_type, item_id)
        if not record or record.input_hash != input_hash:
            return None
        payload = _loads(record.payload_json)
        return {**payload, **_metadata(record)}
    finally:
        db.close()


def mark_queued(item_type: str, item_id: str, input_hash: str, model: str, force: bool = False) -> dict[str, Any]:
    db = SessionLocal()
    try:
        record = _record(db, item_type, item_id)
        if not record:
            record = LlmEnhancementRecord(item_type=item_type, item_id=item_id)
            db.add(record)
        if force or record.input_hash != input_hash:
            record.payload_json = "{}"
            record.enhanced = False
            record.generated_at = ""
            record.attempt_count = 0
        record.input_hash = input_hash
        record.status = "queued"
        record.model = model
        record.fallback_reason = ""
        record.last_error = ""
        record.updated_at = _now()
        db.commit()
        return _metadata(record)
    finally:
        db.close()


def mark_processing(item_type: str, item_id: str, input_hash: str, model: str) -> dict[str, Any]:
    db = SessionLocal()
    try:
        record = _record(db, item_type, item_id)
        if not record:
            record = LlmEnhancementRecord(item_type=item_type, item_id=item_id, input_hash=input_hash)
            db.add(record)
        record.input_hash = input_hash
        record.status = "processing"
        record.model = model
        record.attempt_count = int(record.attempt_count or 0) + 1
        record.updated_at = _now()
        db.commit()
        return _metadata(record)
    finally:
        db.close()


def persist_result(
    item_type: str,
    item_id: str,
    input_hash: str,
    payload: dict[str, Any],
    duration_ms: int,
) -> dict[str, Any]:
    db = SessionLocal()
    try:
        record = _record(db, item_type, item_id)
        if not record:
            record = LlmEnhancementRecord(item_type=item_type, item_id=item_id, input_hash=input_hash)
            db.add(record)
        enhanced = bool(payload.get("llm_enhanced") or payload.get("llmEnhanced"))
        fallback_reason = str(payload.get("llm_fallback_reason") or payload.get("llmFallbackReason") or "")
        record.input_hash = input_hash
        record.status = "completed" if enhanced else "fallback"
        record.enhanced = enhanced
        record.payload_json = json.dumps(payload, default=str)
        record.model = str(payload.get("llm_model") or payload.get("llmModel") or record.model or "")
        record.fallback_reason = fallback_reason
        record.last_error = "" if enhanced else fallback_reason
        record.duration_ms = max(0, int(duration_ms))
        record.generated_at = str(payload.get("llm_generated_at") or payload.get("llmGeneratedAt") or _now())
        record.updated_at = _now()
        _persist_recommendation_copy(db, item_type, item_id, payload)
        db.commit()
        return _metadata(record)
    finally:
        db.close()


def enhancement_status_snapshot(item_type: str | None = None, include_items: bool = False) -> dict[str, Any]:
    db = SessionLocal()
    try:
        query = db.query(LlmEnhancementRecord)
        if item_type:
            query = query.filter(LlmEnhancementRecord.item_type == item_type)
        rows = query.order_by(LlmEnhancementRecord.updated_at.desc(), LlmEnhancementRecord.id.desc()).all()
        counts = {status: 0 for status in ["not_requested", "queued", "processing", "completed", "failed", "fallback"]}
        by_type: dict[str, dict[str, int]] = {}
        for row in rows:
            counts[row.status] = counts.get(row.status, 0) + 1
            type_counts = by_type.setdefault(row.item_type, {status: 0 for status in counts})
            type_counts[row.status] = type_counts.get(row.status, 0) + 1
        output: dict[str, Any] = {
            "total": len(rows),
            **counts,
            "pending": counts.get("queued", 0) + counts.get("processing", 0),
            "byType": by_type,
            "lastUpdated": rows[0].updated_at if rows else "",
        }
        if include_items:
            output["items"] = [
                {
                    "itemType": row.item_type,
                    "itemId": row.item_id,
                    "status": row.status,
                    "enhanced": row.enhanced,
                    "model": row.model,
                    "fallbackReason": row.fallback_reason or None,
                    "attemptCount": row.attempt_count,
                    "lastError": row.last_error or None,
                    "durationMs": row.duration_ms,
                    "generatedAt": row.generated_at,
                    "updatedAt": row.updated_at,
                }
                for row in rows
            ]
        return output
    finally:
        db.close()


def _persist_recommendation_copy(db: Session, item_type: str, item_id: str, payload: dict[str, Any]) -> None:
    if item_type != "recommendation":
        return
    rows = db.query(RecommendationRecord).order_by(RecommendationRecord.id.desc()).limit(400).all()
    for row in rows:
        data = _loads(row.recommendation_data)
        identifiers = {
            str(data.get("recommendationKey") or ""),
            str(data.get("id") or ""),
            str(data.get("instrumentName") or ""),
        }
        if item_id not in identifiers:
            continue
        data.update(payload)
        row.recommendation_data = json.dumps(data, default=str)
        row.confidence_score = int(data.get("confidenceScore") or row.confidence_score)
        break


def _record(db: Session, item_type: str, item_id: str) -> LlmEnhancementRecord | None:
    return (
        db.query(LlmEnhancementRecord)
        .filter(LlmEnhancementRecord.item_type == item_type)
        .filter(LlmEnhancementRecord.item_id == item_id)
        .first()
    )


def _metadata(record: LlmEnhancementRecord) -> dict[str, Any]:
    pending = record.status in {"queued", "processing"}
    return {
        "llm_status": record.status,
        "llm_enhanced": record.enhanced,
        "llm_model": record.model,
        "llm_generated_at": record.generated_at,
        "llm_fallback_reason": record.fallback_reason or None,
        "llm_attempt_count": record.attempt_count,
        "llm_last_error": record.last_error or None,
        "llm_enhancement_status": record.status,
        "llm_enhancement_pending": pending,
        "llmEnhanced": record.enhanced,
        "llmModel": record.model,
        "llmGeneratedAt": record.generated_at,
        "llmFallbackReason": record.fallback_reason or None,
        "llmEnhancementStatus": record.status,
        "llmEnhancementPending": pending,
    }


def _loads(value: str) -> dict[str, Any]:
    try:
        decoded = json.loads(value or "{}")
        return decoded if isinstance(decoded, dict) else {}
    except json.JSONDecodeError:
        return {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
