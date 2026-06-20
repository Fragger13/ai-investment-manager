from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PendingRegistration(Base):
    """A registration awaiting email (OTP) verification.

    No `users` row exists until the code is confirmed — at which point the
    account is created from this record and this row is deleted. This keeps
    unverified sign-ups out of the real user table entirely.
    """

    __tablename__ = "pending_registrations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    verification_code: Mapped[str] = mapped_column(String(12))
    verification_code_expires: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[str] = mapped_column(String(40))
    code_issued_at: Mapped[str] = mapped_column(String(40))
