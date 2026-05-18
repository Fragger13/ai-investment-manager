from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationSource(Base):
    __tablename__ = "recommendation_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    recommendation_id: Mapped[int | None] = mapped_column(ForeignKey("recommendations.id"), nullable=True)
    source_name: Mapped[str] = mapped_column(String(120))
    source_url: Mapped[str] = mapped_column(String(800))
    signal_id: Mapped[int | None] = mapped_column(ForeignKey("market_signals.id"), nullable=True)
    support_type: Mapped[str] = mapped_column(String(80), default="supporting")
    retrieved_at: Mapped[str] = mapped_column(String(80))
    credibility_score: Mapped[int] = mapped_column(Integer, default=50)
