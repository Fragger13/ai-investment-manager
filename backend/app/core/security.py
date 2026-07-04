from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except (TypeError, ValueError):
        return False


def password_hash_supported(password_hash: str) -> bool:
    return bool(pwd_context.identify(password_hash))


def create_access_token(subject: str, dek_claim: str | None = None) -> str:
    # `dek_claim` is the user's data encryption key (see core/data_encryption).
    # It lives only inside tokens held by the user's device — never at rest
    # server-side — which is what keeps their financial data unreadable here.
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire, "type": "access"}
    if dek_claim:
        payload["dk"] = dek_claim
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, dek_claim: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    payload = {"sub": subject, "exp": expire, "type": "refresh"}
    if dek_claim:
        payload["dk"] = dek_claim
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def user_from_bearer(authorization: str | None, db):
    """Resolve the User for a "Bearer <access-token>" Authorization header.

    Returns None for a missing/invalid/expired token instead of raising, so
    routes can fall back to guest scoping. Shared by every route that needs
    per-user data isolation (onboarding, memory actions, portfolio summary).
    """
    from jose import JWTError

    from app.repositories.user_repository import UserRepository

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
