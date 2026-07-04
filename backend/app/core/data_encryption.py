"""Application-level encryption for user financial data.

Threat model: whoever operates the server can open the SQLite file and the
uploaded-documents folder, but must not be able to read users' financial
data. Identity fields (users.name, users.email) stay readable on purpose.

Design ("zero access at rest"):
  * Every user gets a random 32-byte data encryption key (DEK).
  * The DEK is persisted only WRAPPED (AES-256-GCM) under a key derived from
    the user's password (PBKDF2-HMAC-SHA256). The server can therefore
    recover it exclusively while the password is in hand — at login.
  * The raw DEK travels in the user's signed JWT (`dk` claim), which lives on
    the user's device. Every API request re-presents it; EncryptionContextMiddleware
    exposes it to the ORM through a ContextVar for that request only.
  * Anonymous (guest) traffic encrypts under a server-derived guest key so
    the database stays uniformly ciphered.
  * Tokens minted before this feature carry no `dk`. Those sessions run in
    "legacy" mode: reads pass plaintext through, writes stay plaintext (never
    the guest key, which the user's own DEK could not decrypt later). The
    next real login wraps a DEK and migrates the user's plaintext rows.

Consequence to be aware of: a forgotten password makes the wrapped DEK — and
with it the user's financial data — unrecoverable. That is the point.
"""

from __future__ import annotations

import base64
import logging
import secrets
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterator

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

TEXT_PREFIX = "enc:v1:"
FILE_MAGIC = b"AENC1"
_KDF_ITERATIONS = 200_000
_GUEST_SALT = b"askpapa-data-at-rest-v1"
_RECOVERY_SALT = b"askpapa-password-recovery-v1"
# Secrets that previously derived the guest key. When data_encryption_secret
# is (re)configured, the startup sweep re-ciphers rows from these under the
# current key so a secret rotation never orphans data.
_LEGACY_GUEST_SECRETS = ["prototype-secret-change-me"]


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

def generate_dek() -> bytes:
    return secrets.token_bytes(32)


def _derive_key(secret: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=_KDF_ITERATIONS)
    return kdf.derive(secret.encode("utf-8"))


def _seal(data: bytes, key: bytes) -> bytes:
    nonce = secrets.token_bytes(12)
    return nonce + AESGCM(key).encrypt(nonce, data, None)


def _open(blob: bytes, key: bytes) -> bytes | None:
    if len(blob) < 13:
        return None
    try:
        return AESGCM(key).decrypt(blob[:12], blob[12:], None)
    except (InvalidTag, ValueError):
        return None


@lru_cache(maxsize=1)
def guest_key() -> bytes:
    """Server-derived key for data written outside any user session."""
    secret = settings.data_encryption_secret or settings.jwt_secret
    return _derive_key(secret, _GUEST_SALT)


@lru_cache(maxsize=1)
def legacy_guest_keys() -> tuple[bytes, ...]:
    """Guest keys derived from retired secrets, used only to rekey old rows."""
    current = settings.data_encryption_secret or settings.jwt_secret
    return tuple(_derive_key(secret, _GUEST_SALT) for secret in _LEGACY_GUEST_SECRETS if secret != current)


@lru_cache(maxsize=1)
def recovery_key() -> bytes:
    """Wraps the escrow copy of each user's DEK so a password reset can
    re-wrap it under the new password instead of losing the data. Held only
    in the server environment — the database alone cannot open escrows."""
    secret = settings.recovery_master_key or settings.jwt_secret
    return _derive_key(secret, _RECOVERY_SALT)


# ---------------------------------------------------------------------------
# DEK wrapping (password / server)
# ---------------------------------------------------------------------------

def wrap_key_with_password(dek: bytes, password: str) -> tuple[str, str]:
    """Returns (wrapped_b64, salt_b64)."""
    salt = secrets.token_bytes(16)
    kek = _derive_key(password, salt)
    return _b64e(_seal(dek, kek)), _b64e(salt)


def unwrap_key_with_password(wrapped_b64: str, salt_b64: str, password: str) -> bytes | None:
    try:
        wrapped, salt = _b64d(wrapped_b64), _b64d(salt_b64)
    except (TypeError, ValueError):
        return None
    return _open(wrapped, _derive_key(password, salt))


def wrap_key_with_server(dek: bytes) -> str:
    return _b64e(_seal(dek, guest_key()))


def unwrap_key_with_server(wrapped_b64: str) -> bytes | None:
    try:
        return _open(_b64d(wrapped_b64), guest_key())
    except (TypeError, ValueError):
        return None


def wrap_key_with_recovery(dek: bytes) -> str:
    return _b64e(_seal(dek, recovery_key()))


def unwrap_key_with_recovery(wrapped_b64: str) -> bytes | None:
    try:
        return _open(_b64d(wrapped_b64), recovery_key())
    except (TypeError, ValueError):
        return None


def dek_to_claim(dek: bytes) -> str:
    return _b64e(dek)


def dek_from_claim(claim: str) -> bytes | None:
    try:
        dek = _b64d(claim)
    except (TypeError, ValueError):
        return None
    return dek if len(dek) == 32 else None


# ---------------------------------------------------------------------------
# Value encryption (DB columns / files)
# ---------------------------------------------------------------------------

def encrypt_text(plain: str, key: bytes) -> str:
    return TEXT_PREFIX + _b64e(_seal(plain.encode("utf-8"), key))


def decrypt_text(value: str, key: bytes) -> str | None:
    if not value.startswith(TEXT_PREFIX):
        return None
    try:
        blob = _b64d(value[len(TEXT_PREFIX):])
    except (TypeError, ValueError):
        return None
    plain = _open(blob, key)
    return plain.decode("utf-8", errors="replace") if plain is not None else None


def is_encrypted_text(value: str) -> bool:
    return isinstance(value, str) and value.startswith(TEXT_PREFIX)


def encrypt_file_bytes(data: bytes, key: bytes) -> bytes:
    return FILE_MAGIC + _seal(data, key)


def decrypt_file_bytes(data: bytes, key: bytes) -> bytes | None:
    if not data.startswith(FILE_MAGIC):
        return data  # legacy plaintext file
    return _open(data[len(FILE_MAGIC):], key)


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text.encode("ascii"))


# ---------------------------------------------------------------------------
# Request-scoped key context
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class EncryptionScope:
    mode: str  # "user" | "guest" | "legacy"
    key: bytes | None


_GUEST_SCOPE = EncryptionScope("guest", None)  # key resolved lazily via guest_key()
_LEGACY_SCOPE = EncryptionScope("legacy", None)
_scope: ContextVar[EncryptionScope] = ContextVar("encryption_scope", default=_GUEST_SCOPE)


def current_scope() -> EncryptionScope:
    return _scope.get()


def bind_key() -> bytes | None:
    """Key for writes. None means write plaintext (legacy session)."""
    scope = _scope.get()
    if scope.mode == "user":
        return scope.key
    if scope.mode == "guest":
        return guest_key()
    return None


def read_keys() -> list[bytes]:
    """Candidate keys for reads: the session's key first, then the guest key
    so rows written anonymously stay readable after login."""
    scope = _scope.get()
    keys: list[bytes] = []
    if scope.mode == "user" and scope.key:
        keys.append(scope.key)
    keys.append(guest_key())
    return keys


@contextmanager
def use_key(dek: bytes) -> Iterator[None]:
    """Run a block under a specific user key (login-time migration)."""
    token = _scope.set(EncryptionScope("user", dek))
    try:
        yield
    finally:
        _scope.reset(token)


def run_with_scope(scope: EncryptionScope, fn, *args, **kwargs):
    """Run fn under a captured scope — for background threads that finish a
    request's work after the request context is gone."""
    token = _scope.set(scope)
    try:
        return fn(*args, **kwargs)
    finally:
        _scope.reset(token)


def scope_from_bearer(authorization: str | None) -> EncryptionScope:
    """Resolve the encryption scope for a request from its Authorization
    header, without touching the database."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return _GUEST_SCOPE
    token = authorization.split(" ", 1)[1].strip()
    from jose import JWTError, jwt

    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return _GUEST_SCOPE
    if not decoded.get("sub"):
        return _GUEST_SCOPE
    claim = decoded.get("dk")
    if not claim:
        return _LEGACY_SCOPE
    dek = dek_from_claim(str(claim))
    if dek is None:
        logger.warning("[encryption] malformed dk claim on token; treating session as legacy")
        return _LEGACY_SCOPE
    return EncryptionScope("user", dek)


class EncryptionContextMiddleware:
    """Pure ASGI middleware: pins the request's encryption scope for the
    duration of the request so the ORM column types can reach it."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        authorization = None
        for name, value in scope.get("headers") or []:
            if name == b"authorization":
                authorization = value.decode("latin-1")
                break
        token = _scope.set(scope_from_bearer(authorization))
        try:
            await self.app(scope, receive, send)
        finally:
            _scope.reset(token)
