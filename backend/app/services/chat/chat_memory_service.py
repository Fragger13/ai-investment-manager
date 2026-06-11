from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.activity_record import ActivityRecord
from app.services.intelligence import now_iso


def recent_chat_messages(db: Session, limit: int = 6) -> list[dict[str, Any]]:
    rows = db.query(ActivityRecord).filter(ActivityRecord.record_type == "chat").order_by(ActivityRecord.id.desc()).limit(limit).all()
    messages = []
    for row in reversed(rows):
        try:
            messages.append(json.loads(row.payload_json))
        except json.JSONDecodeError:
            continue
    return messages


def save_chat_message(db: Session, message: str, reply: str) -> None:
    db.add(
        ActivityRecord(
            record_type="chat",
            payload_json=json.dumps({"message": message, "reply": reply}),
            created_at=now_iso(),
        )
    )
    db.commit()
