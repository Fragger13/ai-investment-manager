from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LlmEnhancementRecord(Base):
    __tablename__ = "llm_enhancement_records"
    __table_args__ = (UniqueConstraint("item_type", "item_id", name="uq_llm_enhancement_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    item_type: Mapped[str] = mapped_column(String(40), index=True)
    item_id: Mapped[str] = mapped_column(String(240), index=True)
    input_hash: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(40), default="not_requested", index=True)
    enhanced: Mapped[bool] = mapped_column(Boolean, default=False)
    payload_json: Mapped[str] = mapped_column(String, default="{}")
    model: Mapped[str] = mapped_column(String(120), default="")
    fallback_reason: Mapped[str] = mapped_column(String(240), default="")
    last_error: Mapped[str] = mapped_column(String(500), default="")
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    generated_at: Mapped[str] = mapped_column(String(80), default="")
    updated_at: Mapped[str] = mapped_column(String(80), default="")
