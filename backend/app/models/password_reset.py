from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PasswordReset(Base):
    """A pending password-reset link.

    Only the SHA-256 of the emailed token is stored, so reading the database
    is not enough to take over an account. Tokens are single use and expire.
    """

    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[str] = mapped_column(String(40))
    used_at: Mapped[str] = mapped_column(String(40), default="")
