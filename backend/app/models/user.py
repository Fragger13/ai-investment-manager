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

    profile = relationship("FinancialProfile", back_populates="user", uselist=False)
    goals = relationship("Goal", back_populates="user")
