from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationReassessmentLog(Base):
    __tablename__ = "recommendation_reassessment_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    recommendation_key: Mapped[str] = mapped_column(String(240), default="", index=True)
    instrument_name: Mapped[str] = mapped_column(String(240), default="")
    trigger: Mapped[str] = mapped_column(String(160), default="")
    previous_state: Mapped[str] = mapped_column(String(80), default="")
    new_state: Mapped[str] = mapped_column(String(80), default="")
    summary: Mapped[str] = mapped_column(String, default="")
    payload_json: Mapped[str] = mapped_column(String, default="{}")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
