from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SectorImpactScore(Base):
    __tablename__ = "sector_impact_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    sector: Mapped[str] = mapped_column(String(120), index=True)
    direction: Mapped[str] = mapped_column(String(40), default="neutral")
    relative_strength_score: Mapped[int] = mapped_column(Integer, default=50)
    macro_support_score: Mapped[int] = mapped_column(Integer, default=50)
    sentiment_score: Mapped[int] = mapped_column(Integer, default=50)
    risk_score: Mapped[int] = mapped_column(Integer, default=50)
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    retrieved_at: Mapped[str] = mapped_column(String(80))
