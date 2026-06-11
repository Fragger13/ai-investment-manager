"""Minimal Resend HTTP client.

Sends transactional emails via https://resend.com/. Falls back gracefully
when no API key is configured — in that case the email body is logged so
developers can still grab the verification code during local dev.
"""

from __future__ import annotations

import json
import logging
import ssl
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

try:
    import certifi

    _SSL_CONTEXT: ssl.SSLContext | None = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CONTEXT = None

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailResult:
    ok: bool
    provider: str  # "resend" | "console"
    message_id: str | None = None
    error: str | None = None


def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> EmailResult:
    """Send a single transactional email.

    If RESEND_API_KEY is configured, posts to Resend's API. Otherwise logs
    the email contents to the application logger (dev fallback).
    """
    api_key = (settings.resend_api_key or "").strip()
    if not api_key:
        logger.warning(
            "[email] RESEND_API_KEY not set — printing email to console instead of sending."
        )
        logger.info("[email] TO=%s\nSUBJECT=%s\nBODY=%s", to, subject, text or html)
        return EmailResult(ok=True, provider="console")

    payload = {
        "from": settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    request = Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "AskPapa/1.0 (+https://askpapa.app)",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10, context=_SSL_CONTEXT) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
            return EmailResult(ok=True, provider="resend", message_id=str(body.get("id", "")))
    except HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        logger.error("[email] Resend HTTP %s: %s", exc.code, detail)
        return EmailResult(ok=False, provider="resend", error=f"HTTP {exc.code}: {detail or exc.reason}")
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        logger.error("[email] Resend transport error: %s", exc)
        return EmailResult(ok=False, provider="resend", error=str(exc))
