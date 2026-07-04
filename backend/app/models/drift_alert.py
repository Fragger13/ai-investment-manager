from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedText


class DriftAlert(Base):
    __tablename__ = "drift_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    drift_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(40), default="medium")
    title: Mapped[str] = mapped_column(EncryptedText(fallback=""))
    summary: Mapped[str] = mapped_column(EncryptedText(fallback=""))
    metric_name: Mapped[str] = mapped_column(String(120), default="")
    current_value: Mapped[str] = mapped_column(EncryptedText(fallback=""), default="")
    target_value: Mapped[str] = mapped_column(EncryptedText(fallback=""), default="")
    recommendation: Mapped[str] = mapped_column(EncryptedText(fallback=""), default="")
    payload_json: Mapped[str] = mapped_column(EncryptedText(fallback="{}"), default="{}")
    status: Mapped[str] = mapped_column(String(40), default="open")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
