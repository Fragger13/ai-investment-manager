from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    # A `users` row only exists once email is verified (see PendingRegistration),
    # so this is True for every real account. Kept for API-response compatibility.
    email_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Data encryption key wrapped under the user's password (core/data_encryption).
    # Empty for accounts created before encryption; filled on their next login.
    dek_wrapped: Mapped[str] = mapped_column(String, default="", nullable=False)
    dek_salt: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    # Escrow copy of the same key wrapped under the server's recovery secret,
    # so a password reset re-wraps instead of losing the financial data.
    dek_wrapped_recovery: Mapped[str] = mapped_column(String, default="", nullable=False)

    profile = relationship("FinancialProfile", back_populates="user", uselist=False)
    goals = relationship("Goal", back_populates="user")
