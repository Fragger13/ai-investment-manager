from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FinancialMemoryEvent(Base):
    __tablename__ = "financial_memory_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(180))
    summary: Mapped[str] = mapped_column(String)
    entity_type: Mapped[str] = mapped_column(String(80), default="")
    entity_id: Mapped[str] = mapped_column(String(160), default="")
    severity: Mapped[str] = mapped_column(String(40), default="info")
    payload_json: Mapped[str] = mapped_column(String, default="{}")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
