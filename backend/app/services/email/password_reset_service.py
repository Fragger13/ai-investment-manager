"""Email-link password reset that keeps the user's encrypted data.

Flow:
  1. `request_reset(db, email)` mints a one-time token (only its SHA-256 is
     stored), emails a link to `{app_url}/password-reset?token=…&email=…`,
     rate-limited per email. Whether the account exists is never revealed.
  2. `confirm_reset(db, email, token, new_password)` checks the token, sets
     the new password hash and, crucially, re-wraps the account's data
     encryption key from the recovery escrow under the new password — so the
     financial data survives the reset.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.data_encryption import unwrap_key_with_recovery, wrap_key_with_password, wrap_key_with_recovery
from app.core.security import hash_password
from app.models.password_reset import PasswordReset
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.email.resend_client import EmailResult, send_email
from app.services.email.verification_service import VerificationError

logger = logging.getLogger("uvicorn.error")

TOKEN_TTL_MINUTES = 30
RESEND_COOLDOWN_SECONDS = 60


def _now() -> datetime:
    return datetime.now(UTC)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def request_reset(db: Session, email: str) -> EmailResult | None:
    """Returns the email send result, or None when no account exists (the
    caller must respond identically either way)."""
    email = email.strip().lower()
    user = UserRepository(db).get_by_email(email)
    if not user:
        return None
    now = _now()
    latest = (
        db.query(PasswordReset)
        .filter(PasswordReset.email == email)
        .order_by(PasswordReset.id.desc())
        .first()
    )
    if latest and latest.created_at:
        try:
            issued = datetime.fromisoformat(latest.created_at)
            if (now - issued).total_seconds() < RESEND_COOLDOWN_SECONDS:
                raise VerificationError("Please wait a minute before requesting another reset link.")
        except ValueError:
            pass
    token = secrets.token_urlsafe(32)
    db.add(
        PasswordReset(
            email=email,
            token_hash=_hash_token(token),
            expires_at=(now + timedelta(minutes=TOKEN_TTL_MINUTES)).isoformat(),
            created_at=now.isoformat(),
        )
    )
    db.commit()
    link = f"{settings.app_url.rstrip('/')}/password-reset?token={token}&email={quote(email)}"
    result = _send_reset_email(email, user.name, link)
    if not result.ok:
        logger.error("[password-reset] failed to send reset email to %s: %s", email, result.error)
    return result


def confirm_reset(db: Session, email: str, token: str, new_password: str) -> User:
    """Validates the token, sets the new password, and re-wraps the data key
    from escrow so the account's encrypted rows stay readable."""
    email = email.strip().lower()
    user = UserRepository(db).get_by_email(email)
    if not user:
        raise VerificationError("This reset link is not valid. Request a new one.")
    now = _now()
    token_hash = _hash_token((token or "").strip())
    record = (
        db.query(PasswordReset)
        .filter(PasswordReset.email == email)
        .filter(PasswordReset.used_at == "")
        .order_by(PasswordReset.id.desc())
        .first()
    )
    if not record or not secrets.compare_digest(record.token_hash, token_hash):
        raise VerificationError("This reset link is not valid. Request a new one.")
    try:
        expires = datetime.fromisoformat(record.expires_at)
    except ValueError:
        expires = now - timedelta(seconds=1)
    if expires < now:
        raise VerificationError("This reset link has expired. Request a new one.")

    user.password_hash = hash_password(new_password)
    dek = unwrap_key_with_recovery(user.dek_wrapped_recovery) if user.dek_wrapped_recovery else None
    if dek is not None:
        user.dek_wrapped, user.dek_salt = wrap_key_with_password(dek, new_password)
        user.dek_wrapped_recovery = wrap_key_with_recovery(dek)
    else:
        # No escrow (account predates it and never logged in since, or the
        # recovery secret changed). The old key is unrecoverable: leave the
        # ciphered rows in place and let the next login mint a fresh key.
        if user.dek_wrapped:
            logger.error("[password-reset] no usable escrow for user id=%s; their old data stays ciphered", user.id)
        user.dek_wrapped = ""
        user.dek_salt = ""
        user.dek_wrapped_recovery = ""
    record.used_at = now.isoformat()
    # Any other outstanding links for this account die with the reset.
    db.query(PasswordReset).filter(PasswordReset.email == email).filter(PasswordReset.used_at == "").update({"used_at": now.isoformat()})
    db.commit()
    return user


def _send_reset_email(to: str, name: str, link: str) -> EmailResult:
    safe_name = (name or "there").split()[0] or "there"
    subject = "AskPapa — reset your password"
    text = (
        f"Hi {safe_name},\n\n"
        f"Someone asked to reset the password for this AskPapa account. "
        f"If that was you, open this link within {TOKEN_TTL_MINUTES} minutes:\n\n{link}\n\n"
        "If you didn't ask for this, you can ignore this email — your account stays as it is.\n\n"
        "— AskPapa"
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FAFAFA; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <h1 style="font-size: 24px; color: #0F172A; margin: 0 0 16px;">Hi {safe_name}, beta —</h1>
    <p style="font-size: 16px; line-height: 1.6; color: #4B5563; margin: 0 0 24px;">
      Someone asked to reset the password for this AskPapa account. If that was you, tap the button below.
    </p>
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="{link}" style="display: inline-block; background: #138A3C; color: white; font-size: 16px; font-weight: 600; padding: 14px 28px; border-radius: 12px; text-decoration: none;">
        Choose a new password
      </a>
    </div>
    <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0 0 8px;">
      The link expires in {TOKEN_TTL_MINUTES} minutes. Your saved details stay safe through the reset.
    </p>
    <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">
      Didn't ask for this? You can safely ignore this email.
    </p>
    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;">
    <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
      — AskPapa, your financial buddy
    </p>
  </div>
</body>
</html>"""
    return send_email(to=to, subject=subject, html=html, text=text)
