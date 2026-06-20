from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, hash_password, password_hash_supported, verify_password
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    VerificationStatusResponse,
    VerifyEmailRequest,
)
from app.services.email.verification_service import (
    VerificationError,
    resend_code,
    start_registration,
    verify_and_create_user,
)

router = APIRouter()


@router.post("/register", response_model=VerificationStatusResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> VerificationStatusResponse:
    # The account is NOT created here. We stash a pending registration and email
    # a code; the real `users` row is created only when the code is verified.
    users = UserRepository(db)
    email = str(payload.email).strip().lower()
    if users.get_by_email(email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    try:
        result = start_registration(
            db, name=payload.name, email=email, password_hash=hash_password(payload.password)
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
    return AuthResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
        name=user.name,
        email=user.email,
        onboarding_complete=user.onboarding_complete,
        email_verified=user.email_verified,
    )


@router.post("/verify-email", response_model=AuthResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> AuthResponse:
    users = UserRepository(db)
    email = str(payload.email).strip().lower()
    # An existing user means this email was already verified and registered.
    # Don't hand out tokens here (no password proof) — send them to log in.
    if users.get_by_email(email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    try:
        user = verify_and_create_user(db, email, payload.code)
    except VerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AuthResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
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
    return {"access_token": create_access_token(decoded["sub"]), "token_type": "bearer"}


@router.post("/password-reset")
def password_reset(payload: PasswordResetRequest) -> dict[str, str]:
    # Prototype password reset seam. Production should send a time-limited reset link.
    return {"status": "reset-link-sent", "email": payload.email}
