from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationContradiction(Base):
    __tablename__ = "recommendation_contradictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    recommendation_key: Mapped[str] = mapped_column(String(240), index=True)
    instrument_name: Mapped[str] = mapped_column(String(240), index=True)
    contradiction_type: Mapped[str] = mapped_column(String(120), default="")
    severity: Mapped[str] = mapped_column(String(40), default="medium")
    summary: Mapped[str] = mapped_column(String, default="")
    evidence_json: Mapped[str] = mapped_column(String, default="{}")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
