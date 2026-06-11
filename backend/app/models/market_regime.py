from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MarketRegime(Base):
    __tablename__ = "market_regimes"

    id: Mapped[int] = mapped_column(primary_key=True)
    regime_name: Mapped[str] = mapped_column(String(80), index=True)
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    supporting_evidence_json: Mapped[str] = mapped_column(String, default="[]")
    contradictory_evidence_json: Mapped[str] = mapped_column(String, default="[]")
    drivers_json: Mapped[str] = mapped_column(String, default="[]")
    recommended_portfolio_stance: Mapped[str] = mapped_column(String, default="")
    summary: Mapped[str] = mapped_column(String, default="")
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    retrieved_at: Mapped[str] = mapped_column(String(80))
