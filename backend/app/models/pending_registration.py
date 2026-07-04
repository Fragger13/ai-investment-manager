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
    # The account's data encryption key, generated at sign-up: one copy wrapped
    # by the password (promoted onto the User row) and one wrapped by the server
    # key so verify-email can mint a token carrying the key without the password.
    # The server-wrapped copy dies with this row at verification.
    dek_wrapped_password: Mapped[str] = mapped_column(String, default="")
    dek_salt: Mapped[str] = mapped_column(String(64), default="")
    dek_wrapped_server: Mapped[str] = mapped_column(String, default="")
