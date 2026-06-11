from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationReasoning(Base):
    __tablename__ = "recommendation_reasoning"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    recommendation_key: Mapped[str] = mapped_column(String(240), index=True)
    instrument_name: Mapped[str] = mapped_column(String(240), index=True)
    why_recommended: Mapped[str] = mapped_column(String, default="")
    why_now: Mapped[str] = mapped_column(String, default="")
    reasoning_json: Mapped[str] = mapped_column(String, default="{}")
    model_version: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
