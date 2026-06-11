from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SignalImpactMap(Base):
    __tablename__ = "signal_impact_maps"

    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("market_signals.id"), index=True)
    signal_classification: Mapped[str] = mapped_column(String(80), index=True)
    affected_sectors_json: Mapped[str] = mapped_column(String, default="[]")
    affected_asset_classes_json: Mapped[str] = mapped_column(String, default="[]")
    likely_beneficiaries_json: Mapped[str] = mapped_column(String, default="[]")
    likely_losers_json: Mapped[str] = mapped_column(String, default="[]")
    relevant_instruments_json: Mapped[str] = mapped_column(String, default="[]")
    short_term_impact: Mapped[str] = mapped_column(String, default="")
    long_term_impact: Mapped[str] = mapped_column(String, default="")
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    evidence_links_json: Mapped[str] = mapped_column(String, default="[]")
    contradiction_links_json: Mapped[str] = mapped_column(String, default="[]")
    related_recommendations_json: Mapped[str] = mapped_column(String, default="[]")
    portfolio_relevance: Mapped[int] = mapped_column(Integer, default=50)
    goal_relevance: Mapped[int] = mapped_column(Integer, default=50)
    retrieved_at: Mapped[str] = mapped_column(String(80))
