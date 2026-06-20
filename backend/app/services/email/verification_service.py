"""Deferred registration via 6-digit OTP email codes.

A sign-up does NOT create a `users` row. Instead:
  1. `start_registration(db, name, email, password_hash)` stores a
     PendingRegistration (name + hashed password + a 6-digit code, 10-minute
     expiry) and emails the code. No account exists yet.
  2. The user submits the code via the verify-email endpoint.
  3. `verify_and_create_user(db, email, code)` checks expiry + match, then
     creates the real (verified) User, deletes the pending row, returns the user.
  4. `resend_code(db, email)` mints a fresh code on the pending row,
     rate-limited to once per 60s.
"""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.repositories.user_repository import UserRepository
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


def _get_pending(db: Session, email: str) -> PendingRegistration | None:
    return db.query(PendingRegistration).filter(PendingRegistration.email == email).first()


def start_registration(db: Session, *, name: str, email: str, password_hash: str) -> EmailResult:
    """Create or refresh a pending registration and email a fresh code.

    If a pending row already exists for this email (a repeat sign-up before
    verifying), it is updated in place with a new code — subject to the resend
    cooldown so codes can't be spammed.
    """
    email = email.strip().lower()
    now = _now()
    pending = _get_pending(db, email)
    code = _generate_code()
    if pending is None:
        pending = PendingRegistration(
            email=email,
            name=name,
            password_hash=password_hash,
            verification_code=code,
            verification_code_expires=_expires_at(now).isoformat(),
            created_at=now.isoformat(),
            code_issued_at=now.isoformat(),
        )
        db.add(pending)
    else:
        if _is_in_cooldown(pending, now):
            raise VerificationError("Please wait a minute before requesting a new code.")
        pending.name = name
        pending.password_hash = password_hash
        pending.verification_code = code
        pending.verification_code_expires = _expires_at(now).isoformat()
        pending.code_issued_at = now.isoformat()
    db.commit()
    result = _send_verification_email(email, name, code)
    if not result.ok:
        logger.error("[verification] failed to send verification email to %s: %s", email, result.error)
    return result


def resend_code(db: Session, email: str) -> EmailResult:
    """Mint a fresh code on an existing pending registration and email it."""
    email = email.strip().lower()
    pending = _get_pending(db, email)
    if pending is None:
        raise VerificationError("No pending registration found. Please sign up again.")
    now = _now()
    if _is_in_cooldown(pending, now):
        raise VerificationError("Please wait a minute before requesting a new code.")
    pending.verification_code = _generate_code()
    pending.verification_code_expires = _expires_at(now).isoformat()
    pending.code_issued_at = now.isoformat()
    db.commit()
    result = _send_verification_email(email, pending.name, pending.verification_code)
    if not result.ok:
        logger.error("[verification] failed to resend verification email to %s: %s", email, result.error)
    return result


def verify_and_create_user(db: Session, email: str, submitted: str) -> User:
    """Validate the submitted code and promote the pending row into a real User."""
    email = email.strip().lower()
    pending = _get_pending(db, email)
    if pending is None:
        raise VerificationError("No active code on file. Request a new one.")
    submitted = (submitted or "").strip()
    code = (pending.verification_code or "").strip()
    if not code or not submitted:
        raise VerificationError("No active code on file. Request a new one.")
    if pending.verification_code_expires:
        try:
            expires = datetime.fromisoformat(pending.verification_code_expires)
        except ValueError:
            expires = _now() - timedelta(seconds=1)
        if expires < _now():
            raise VerificationError("Code expired. Please request a new one.")
    if not secrets.compare_digest(code, submitted):
        raise VerificationError("That code doesn't match. Check your inbox or request a new one.")

    user = UserRepository(db).create(
        name=pending.name,
        email=pending.email,
        password_hash=pending.password_hash,
    )
    db.delete(pending)
    db.commit()
    return user


def _is_in_cooldown(pending: PendingRegistration, now: datetime | None = None) -> bool:
    """Throttle resends so users can't spam emails."""
    now = now or _now()
    issued_raw = pending.code_issued_at or pending.created_at
    if not issued_raw:
        return False
    try:
        issued = datetime.fromisoformat(issued_raw)
    except ValueError:
        return False
    return (now - issued).total_seconds() < RESEND_COOLDOWN_SECONDS


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
