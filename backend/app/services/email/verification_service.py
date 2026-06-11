"""Email verification — generate, send, validate 6-digit OTP codes.

Flow:
  1. On register, `generate_and_send_code(db, user)` mints a 6-digit code,
     stores it on the user row (10-minute expiry), sends the email.
  2. User submits the code via the verify-email endpoint.
  3. `verify_code(db, user, code)` checks expiry + match, marks
     `email_verified = True`, clears the code fields.
  4. `resend_code(db, user)` rate-limits resends to once per 60s.
"""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.email.resend_client import EmailResult, send_email

logger = logging.getLogger(__name__)

CODE_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60


class VerificationError(Exception):
    """User-facing verification failure (wrong code, expired, etc.)."""


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _now() -> datetime:
    return datetime.now(UTC)


def _expires_at(now: datetime | None = None) -> datetime:
    return (now or _now()) + timedelta(minutes=CODE_TTL_MINUTES)


def generate_and_send_code(db: Session, user: User, *, force: bool = False) -> EmailResult:
    """Mint a fresh code, persist on user, send via email."""
    if not force and user.email_verified:
        # Already verified — no-op.
        return EmailResult(ok=True, provider="noop")
    if not force and _is_in_cooldown(user):
        raise VerificationError("Please wait a minute before requesting a new code.")
    code = _generate_code()
    user.verification_code = code
    user.verification_code_expires = _expires_at().isoformat()
    db.commit()
    result = _send_verification_email(user.email, user.name, code)
    if not result.ok:
        logger.error("[verification] failed to send verification email to %s: %s", user.email, result.error)
    return result


def resend_code(db: Session, user: User) -> EmailResult:
    return generate_and_send_code(db, user)


def verify_code(db: Session, user: User, submitted: str) -> bool:
    """Validate the submitted code; mark verified on success."""
    if user.email_verified:
        return True
    code = (user.verification_code or "").strip()
    submitted = (submitted or "").strip()
    if not code or not submitted:
        raise VerificationError("No active code on file. Request a new one.")
    if user.verification_code_expires:
        try:
            expires = datetime.fromisoformat(user.verification_code_expires)
        except ValueError:
            expires = _now() - timedelta(seconds=1)
        if expires < _now():
            raise VerificationError("Code expired. Please request a new one.")
    if secrets.compare_digest(code, submitted):
        user.email_verified = True
        user.verification_code = None
        user.verification_code_expires = None
        db.commit()
        return True
    raise VerificationError("That code doesn't match. Check your inbox or request a new one.")


def _is_in_cooldown(user: User) -> bool:
    """Throttle resends so users can't spam emails."""
    if not user.verification_code or not user.verification_code_expires:
        return False
    try:
        expires = datetime.fromisoformat(user.verification_code_expires)
    except ValueError:
        return False
    # The code was issued (TTL ago). If the new request is within the cooldown
    # window from the last issue time, throttle it.
    issued = expires - timedelta(minutes=CODE_TTL_MINUTES)
    age = (_now() - issued).total_seconds()
    return age < RESEND_COOLDOWN_SECONDS


def _send_verification_email(to: str, name: str, code: str) -> EmailResult:
    safe_name = (name or "there").split()[0] or "there"
    subject = f"AskPapa — your verification code is {code}"
    text = (
        f"Hi {safe_name},\n\n"
        f"Your AskPapa verification code is: {code}\n\n"
        f"It will expire in {CODE_TTL_MINUTES} minutes. "
        "If you didn't ask for this, you can ignore this email.\n\n"
        "— AskPapa"
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FAFAFA; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <h1 style="font-size: 24px; color: #0F172A; margin: 0 0 16px;">Hi {safe_name}, beta —</h1>
    <p style="font-size: 16px; line-height: 1.6; color: #4B5563; margin: 0 0 24px;">
      Quick check that this email is really you. Type this code into the AskPapa app:
    </p>
    <div style="background: #E9F4EC; border: 1px solid #138A3C; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
      <div style="font-size: 36px; letter-spacing: 8px; font-weight: 700; color: #138A3C; font-family: 'SF Mono', 'Menlo', monospace;">
        {code}
      </div>
    </div>
    <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0 0 8px;">
      The code expires in {CODE_TTL_MINUTES} minutes.
    </p>
    <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">
      Didn't sign up? You can safely ignore this email.
    </p>
    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;">
    <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
      — AskPapa, your financial buddy
    </p>
  </div>
</body>
</html>"""
    return send_email(to=to, subject=subject, html=html, text=text)
