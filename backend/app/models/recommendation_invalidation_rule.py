from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationInvalidationRule(Base):
    __tablename__ = "recommendation_invalidation_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    recommendation_key: Mapped[str] = mapped_column(String(240), index=True)
    instrument_name: Mapped[str] = mapped_column(String(240), index=True)
    rule_type: Mapped[str] = mapped_column(String(120), default="")
    trigger: Mapped[str] = mapped_column(String, default="")
    severity: Mapped[str] = mapped_column(String(40), default="medium")
    suggested_response: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
