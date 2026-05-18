from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MarketSignal(Base):
    __tablename__ = "market_signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    article_id: Mapped[int | None] = mapped_column(ForeignKey("research_articles.id"), nullable=True)
    signal_type: Mapped[str] = mapped_column(String(80), index=True)
    sentiment: Mapped[str] = mapped_column(String(40), index=True)
    asset_classes: Mapped[str] = mapped_column(String, default="[]")
    instruments: Mapped[str] = mapped_column(String, default="[]")
    sectors: Mapped[str] = mapped_column(String, default="[]")
    macro_themes: Mapped[str] = mapped_column(String, default="[]")
    risk_signals: Mapped[str] = mapped_column(String, default="[]")
    opportunity_signals: Mapped[str] = mapped_column(String, default="[]")
    summary: Mapped[str] = mapped_column(String)
    source_url: Mapped[str] = mapped_column(String(800))
    source_name: Mapped[str] = mapped_column(String(120))
    published_at: Mapped[str] = mapped_column(String(80), default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
    relevance_score: Mapped[int] = mapped_column(Integer, default=50)
    credibility_score: Mapped[int] = mapped_column(Integer, default=50)
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    data_mode: Mapped[str] = mapped_column(String(40), default="fallback")
