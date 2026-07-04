"""SQLAlchemy column types that encrypt at rest with the request's data key.

Reads are tolerant by design: legacy plaintext rows pass through unchanged,
and ciphertext that the current session's keys cannot open resolves to the
column's fallback value instead of raising — another user's rows simply look
empty, which doubles as an isolation layer on tables without user scoping.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.data_encryption import bind_key, decrypt_text, encrypt_text, is_encrypted_text, read_keys


def _decrypt_with_session_keys(value: str) -> str | None:
    for key in read_keys():
        plain = decrypt_text(value, key)
        if plain is not None:
            return plain
    return None


class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, fallback: str = "", **kwargs: Any):
        self.fallback = fallback
        super().__init__(**kwargs)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        text = value if isinstance(value, str) else str(value)
        if is_encrypted_text(text):
            return text  # already ciphered (defensive; avoids double encryption)
        key = bind_key()
        return encrypt_text(text, key) if key is not None else text

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        text = value if isinstance(value, str) else str(value)
        if not is_encrypted_text(text):
            return text
        plain = _decrypt_with_session_keys(text)
        return plain if plain is not None else self.fallback


class EncryptedInt(TypeDecorator):
    """Integer stored as ciphertext text. Legacy plain integers pass through;
    undecryptable ciphertext resolves to the fallback (default 0)."""

    impl = Text
    cache_ok = True

    def __init__(self, fallback: int = 0, **kwargs: Any):
        self.fallback = fallback
        super().__init__(**kwargs)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str) and is_encrypted_text(value):
            return value
        try:
            text = str(int(value))
        except (TypeError, ValueError):
            text = "0"
        key = bind_key()
        return encrypt_text(text, key) if key is not None else text

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, int):
            return value
        text = str(value)
        if is_encrypted_text(text):
            plain = _decrypt_with_session_keys(text)
            if plain is None:
                return self.fallback
            text = plain
        try:
            return int(float(text))
        except (TypeError, ValueError):
            return self.fallback
