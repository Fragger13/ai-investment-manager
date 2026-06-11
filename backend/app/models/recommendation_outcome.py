from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationOutcome(Base):
    __tablename__ = "recommendation_outcomes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    recommendation_key: Mapped[str] = mapped_column(String(240), index=True)
    instrument_name: Mapped[str] = mapped_column(String(240), default="")
    status: Mapped[str] = mapped_column(String(80), default="open")
    action_count: Mapped[int] = mapped_column(Integer, default=0)
    last_action: Mapped[str] = mapped_column(String(80), default="")
    notes: Mapped[str] = mapped_column(String, default="")
    updated_at: Mapped[str] = mapped_column(String(80), index=True)
