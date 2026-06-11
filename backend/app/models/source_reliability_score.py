from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SourceReliabilityScore(Base):
    __tablename__ = "source_reliability_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), index=True)
    reliability_score: Mapped[int] = mapped_column(Integer, default=50)
    bias_risk_score: Mapped[int] = mapped_column(Integer, default=30)
    freshness_score: Mapped[int] = mapped_column(Integer, default=50)
    availability_score: Mapped[int] = mapped_column(Integer, default=50)
    final_reliability_score: Mapped[int] = mapped_column(Integer, default=50)
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    message: Mapped[str] = mapped_column(String(500), default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
