from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FundamentalMetric(Base):
    __tablename__ = "fundamental_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_symbol: Mapped[str] = mapped_column(String(40), index=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    data_completeness: Mapped[str] = mapped_column(String(40), default="low")
    revenue_growth_trend: Mapped[str] = mapped_column(String(160), default="limited data")
    profit_growth_trend: Mapped[str] = mapped_column(String(160), default="limited data")
    margin_trend: Mapped[str] = mapped_column(String(160), default="limited data")
    debt_level: Mapped[str] = mapped_column(String(160), default="limited data")
    roe_roce: Mapped[str] = mapped_column(String(160), default="limited data")
    valuation_proxy: Mapped[str] = mapped_column(String(160), default="limited data")
    earnings_momentum: Mapped[str] = mapped_column(String(160), default="limited data")
    promoter_holding: Mapped[str] = mapped_column(String(160), default="limited data")
    institutional_holding: Mapped[str] = mapped_column(String(160), default="limited data")
    sector_tailwind_score: Mapped[int] = mapped_column(Integer, default=50)
    recent_news_sentiment: Mapped[str] = mapped_column(String(40), default="neutral")
    corporate_action_risk: Mapped[str] = mapped_column(String(160), default="limited data")
    fundamental_score: Mapped[int] = mapped_column(Integer, default=50)
    evidence_json: Mapped[str] = mapped_column(String, default="[]")
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    retrieved_at: Mapped[str] = mapped_column(String(80))
