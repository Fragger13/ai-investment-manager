from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortfolioBucketAllocation(Base):
    __tablename__ = "portfolio_bucket_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("portfolio_optimization_runs.id"), index=True)
    bucket_key: Mapped[str] = mapped_column(String(80), index=True)
    bucket_name: Mapped[str] = mapped_column(String(120))
    current_value: Mapped[int] = mapped_column(Integer, default=0)
    current_percentage: Mapped[int] = mapped_column(Integer, default=0)
    target_value: Mapped[int] = mapped_column(Integer, default=0)
    target_percentage: Mapped[int] = mapped_column(Integer, default=0)
    gap_value: Mapped[int] = mapped_column(Integer, default=0)
    gap_percentage: Mapped[int] = mapped_column(Integer, default=0)
    monthly_contribution: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(40), default="medium")
    linked_goals_json: Mapped[str] = mapped_column(String, default="[]")

