from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortfolioRebalancingSuggestion(Base):
    __tablename__ = "portfolio_rebalancing_suggestions"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("portfolio_optimization_runs.id"), index=True)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    action: Mapped[str] = mapped_column(String(80), default="review")
    bucket_key: Mapped[str] = mapped_column(String(80), default="")
    title: Mapped[str] = mapped_column(String(180), default="")
    explanation: Mapped[str] = mapped_column(String, default="")
    monthly_amount: Mapped[int] = mapped_column(Integer, default=0)
    drift_percentage: Mapped[int] = mapped_column(Integer, default=0)
    risk_impact: Mapped[str] = mapped_column(String(80), default="neutral")
    trigger: Mapped[str] = mapped_column(String, default="")

