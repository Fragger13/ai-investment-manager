from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.feedback import Feedback
from app.services.intelligence import now_iso

logger = logging.getLogger(__name__)
router = APIRouter()

OWNER_EMAIL = "ltanishq13@gmail.com"


class FeedbackRequest(BaseModel):
    kind: str = "contact"      # "rating" (stars prompt) | "contact" (help form)
    category: str = ""
    rating: int = 0
    message: str = ""
    email: str = ""            # the user's email, for a reply (optional)
    page: str = ""


@router.post("")
def submit_feedback(payload: FeedbackRequest, db: Session = Depends(get_db)) -> dict:
    """Persist user feedback and best-effort email the owner. Storing always
    succeeds; the email is fire-and-forget so a mail hiccup never loses feedback."""
    row = Feedback(
        kind=(payload.kind or "contact").strip()[:40],
        category=(payload.category or "").strip()[:120],
        rating=max(0, min(int(payload.rating or 0), 5)),
        message=(payload.message or "").strip()[:5000],
        email=(payload.email or "").strip()[:240],
        page=(payload.page or "").strip()[:160],
        created_at=now_iso(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    try:
        _notify_owner(row)
    except Exception as exc:  # noqa: BLE001 — never fail the request on email issues
        logger.warning("[feedback] owner email failed: %s", exc)
    return {"status": "ok", "id": row.id}


def _notify_owner(row: Feedback) -> None:
    from app.services.email.resend_client import send_email

    stars = f" · {row.rating}★" if row.rating else ""
    subject = f"[AskPapa · {row.kind}] {row.category or 'feedback'}{stars}"
    fields = [
        ("Kind", row.kind),
        ("Category", row.category or "—"),
        ("Rating", f"{row.rating}/5" if row.rating else "—"),
        ("From", row.email or "anonymous"),
        ("Page", row.page or "—"),
        ("At", row.created_at),
    ]
    text = "\n".join(f"{k}: {v}" for k, v in fields) + "\n\n" + (row.message or "(no message)")
    html = "".join(f"<p style='margin:2px 0'><b>{k}:</b> {v}</p>" for k, v in fields) + (
        f"<hr><p style='white-space:pre-wrap'>{row.message or '(no message)'}</p>"
    )
    send_email(to=OWNER_EMAIL, subject=subject, html=html, text=text)
