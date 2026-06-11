from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortfolioTargetAllocation(Base):
    __tablename__ = "portfolio_target_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("portfolio_optimization_runs.id"), index=True)
    bucket_key: Mapped[str] = mapped_column(String(80), index=True)
    bucket_name: Mapped[str] = mapped_column(String(120))
    target_percentage: Mapped[int] = mapped_column(Integer, default=0)
    min_percentage: Mapped[int] = mapped_column(Integer, default=0)
    max_percentage: Mapped[int] = mapped_column(Integer, default=0)
    expected_return: Mapped[int] = mapped_column(Integer, default=0)
    volatility: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(40), default="medium")
    rationale: Mapped[str] = mapped_column(String, default="")

