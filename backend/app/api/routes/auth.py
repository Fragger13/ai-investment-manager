import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base
from app.core.data_encryption import (
    dek_to_claim,
    generate_dek,
    unwrap_key_with_password,
    unwrap_key_with_recovery,
    wrap_key_with_password,
    wrap_key_with_recovery,
    wrap_key_with_server,
)
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, hash_password, password_hash_supported, verify_password
from app.repositories.user_repository import UserRepository
from app.services.data_key_migration import migrate_user_rows_to_encrypted
from app.schemas.auth import (
    AuthResponse,
    DeleteAccountRequest,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    VerificationStatusResponse,
    VerifyEmailRequest,
)
from app.services.email.password_reset_service import confirm_reset, request_reset
from app.services.email.verification_service import (
    VerificationError,
    resend_code,
    start_registration,
    verify_and_create_user,
)

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


@router.post("/register", response_model=VerificationStatusResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> VerificationStatusResponse:
    # The account is NOT created here. We stash a pending registration and email
    # a code; the real `users` row is created only when the code is verified.
    users = UserRepository(db)
    email = str(payload.email).strip().lower()
    if users.get_by_email(email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    # The account's data encryption key is born here, while the password is in
    # hand. It is stored only wrapped: by the password (permanent) and by the
    # server key (transient, so verify-email can issue a keyed token).
    dek = generate_dek()
    dek_wrapped_password, dek_salt = wrap_key_with_password(dek, payload.password)
    try:
        result = start_registration(
            db,
            name=payload.name,
            email=email,
            password_hash=hash_password(payload.password),
            dek_wrapped_password=dek_wrapped_password,
            dek_salt=dek_salt,
            dek_wrapped_server=wrap_key_with_server(dek),
        )
    except VerificationError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    return VerificationStatusResponse(
        email=email,
        email_verified=False,
        sent=result.ok,
        provider=result.provider,
        detail=result.error,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    users = UserRepository(db)
    user = users.get_by_email(str(payload.email))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not password_hash_supported(user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password reset required because this account uses an unsupported local password hash",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")
    dek_claim = _resolve_dek_claim(db, user, payload.password)
    return AuthResponse(
        access_token=create_access_token(user.email, dek_claim),
        refresh_token=create_refresh_token(user.email, dek_claim),
        name=user.name,
        email=user.email,
        onboarding_complete=user.onboarding_complete,
        email_verified=user.email_verified,
    )


def _resolve_dek_claim(db: Session, user, password: str) -> str | None:
    """Unwrap the user's data key with the password just proven. Accounts from
    before encryption get their key created now, and their stored plaintext
    rows are re-encrypted under it in the same breath."""
    if user.dek_wrapped and user.dek_salt:
        dek = unwrap_key_with_password(user.dek_wrapped, user.dek_salt, password)
        if dek is None:
            # Wrapped key exists but the (correct) password cannot open it —
            # wrap drift. Issue a legacy token instead of locking the user out.
            logger.error("[encryption] DEK unwrap failed for user id=%s; issuing legacy token", user.id)
            return None
        if not user.dek_wrapped_recovery:
            user.dek_wrapped_recovery = wrap_key_with_recovery(dek)
            db.commit()
        return dek_to_claim(dek)
    dek = generate_dek()
    user.dek_wrapped, user.dek_salt = wrap_key_with_password(dek, password)
    user.dek_wrapped_recovery = wrap_key_with_recovery(dek)
    db.commit()
    migrate_user_rows_to_encrypted(db, user, dek)
    return dek_to_claim(dek)


@router.post("/verify-email", response_model=AuthResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> AuthResponse:
    users = UserRepository(db)
    email = str(payload.email).strip().lower()
    # An existing user means this email was already verified and registered.
    # Don't hand out tokens here (no password proof) — send them to log in.
    if users.get_by_email(email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    try:
        user, dek = verify_and_create_user(db, email, payload.code)
    except VerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    dek_claim = dek_to_claim(dek) if dek else None
    return AuthResponse(
        access_token=create_access_token(user.email, dek_claim),
        refresh_token=create_refresh_token(user.email, dek_claim),
        name=user.name,
        email=user.email,
        onboarding_complete=user.onboarding_complete,
        email_verified=user.email_verified,
    )


@router.post("/resend-verification", response_model=VerificationStatusResponse)
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)) -> VerificationStatusResponse:
    users = UserRepository(db)
    email = str(payload.email).strip().lower()
    if users.get_by_email(email):
        return VerificationStatusResponse(email=email, email_verified=True, sent=False, detail="Already verified")
    try:
        result = resend_code(db, email)
    except VerificationError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    return VerificationStatusResponse(
        email=email,
        email_verified=False,
        sent=result.ok,
        provider=result.provider,
        detail=result.error,
    )


@router.post("/refresh")
def refresh(payload: RefreshRequest) -> dict[str, str]:
    try:
        decoded = jwt.decode(payload.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
    if decoded.get("type") != "refresh" or not decoded.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return {"access_token": create_access_token(decoded["sub"], decoded.get("dk")), "token_type": "bearer"}


@router.post("/password-reset")
def password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    """Email a time-limited reset link. The response never reveals whether an
    account exists for the address."""
    try:
        request_reset(db, str(payload.email))
    except VerificationError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    return {"status": "reset-link-sent", "email": payload.email}


@router.post("/password-reset/confirm")
def password_reset_confirm(payload: PasswordResetConfirmRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    """Set a new password from an emailed link. The account's data key is
    re-wrapped from the recovery escrow, so the financial data stays intact."""
    try:
        user = confirm_reset(db, str(payload.email), payload.token, payload.password)
    except VerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"status": "password-updated", "email": user.email}


def _user_from_auth_header(authorization: str | None, db: Session):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if decoded.get("type") != "access" or not decoded.get("sub"):
        return None
    return UserRepository(db).get_by_email(decoded["sub"])


@router.delete("/account")
def delete_account(
    payload: DeleteAccountRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Permanently erase the account and every row it owns. Requires a valid
    session token AND the account password, so a leaked token alone cannot do
    it. This is a real deletion, not a soft flag: the encrypted financial data
    is gone for good."""
    user = _user_from_auth_header(authorization, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in again to delete your account")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")

    uid, email = user.id, user.email
    # Wipe every table that belongs to this user. Iterating the metadata means new
    # user-scoped tables are covered automatically, no per-table list to maintain.
    for table in reversed(Base.metadata.sorted_tables):
        if "user_id" in table.columns:
            db.execute(delete(table).where(table.c.user_id == uid))
    for table_name in ("feedback", "password_resets", "pending_registrations"):
        table = Base.metadata.tables.get(table_name)
        if table is not None and "email" in table.columns:
            db.execute(delete(table).where(table.c.email == email))
    db.delete(user)
    db.commit()
    logger.info("[account] deleted account id=%s and all owned rows", uid)
    return {"status": "account-deleted", "email": email}
