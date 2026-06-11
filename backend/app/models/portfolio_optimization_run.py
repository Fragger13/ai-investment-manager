from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortfolioOptimizationRun(Base):
    __tablename__ = "portfolio_optimization_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    profile_snapshot_json: Mapped[str] = mapped_column(String, default="{}")
    market_regime: Mapped[str] = mapped_column(String(80), default="balanced")
    risk_profile: Mapped[str] = mapped_column(String(80), default="balanced")
    total_portfolio_value: Mapped[int] = mapped_column(Integer, default=0)
    monthly_surplus: Mapped[int] = mapped_column(Integer, default=0)
    diversification_score: Mapped[int] = mapped_column(Integer, default=0)
    concentration_score: Mapped[int] = mapped_column(Integer, default=0)
    volatility_score: Mapped[int] = mapped_column(Integer, default=0)
    goal_alignment_score: Mapped[int] = mapped_column(Integer, default=0)
    allocation_drift_score: Mapped[int] = mapped_column(Integer, default=0)
    tactical_allocation_cap: Mapped[int] = mapped_column(Integer, default=0)
    crypto_allocation_cap: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))

