from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DriftAlert(Base):
    __tablename__ = "drift_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    drift_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(40), default="medium")
    title: Mapped[str] = mapped_column(String(180))
    summary: Mapped[str] = mapped_column(String)
    metric_name: Mapped[str] = mapped_column(String(120), default="")
    current_value: Mapped[str] = mapped_column(String(80), default="")
    target_value: Mapped[str] = mapped_column(String(80), default="")
    recommendation: Mapped[str] = mapped_column(String, default="")
    payload_json: Mapped[str] = mapped_column(String, default="{}")
    status: Mapped[str] = mapped_column(String(40), default="open")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
