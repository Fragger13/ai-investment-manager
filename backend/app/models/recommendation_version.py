from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationVersion(Base):
    __tablename__ = "recommendation_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    recommendation_key: Mapped[str] = mapped_column(String(240), index=True)
    instrument_name: Mapped[str] = mapped_column(String(240), index=True)
    asset_type: Mapped[str] = mapped_column(String(120), default="")
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    recommendation_json: Mapped[str] = mapped_column(String)
    change_reason: Mapped[str] = mapped_column(String, default="")
    changed_fields_json: Mapped[str] = mapped_column(String, default="[]")
    market_regime: Mapped[str] = mapped_column(String(80), default="")
    conviction_score: Mapped[int] = mapped_column(Integer, default=0)
    confidence_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(40), default="")
    state: Mapped[str] = mapped_column(String(40), default="active")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
