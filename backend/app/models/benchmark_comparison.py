from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BenchmarkComparison(Base):
    __tablename__ = "benchmark_comparisons"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_symbol: Mapped[str] = mapped_column(String(60), index=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    strategy_type: Mapped[str] = mapped_column(String(80), index=True)
    benchmark_name: Mapped[str] = mapped_column(String(120), default="NIFTY 50")
    benchmark_symbol: Mapped[str] = mapped_column(String(60), default="^NSEI")
    strategy_average_return: Mapped[float] = mapped_column(Float, default=0)
    benchmark_average_return: Mapped[float] = mapped_column(Float, default=0)
    excess_return: Mapped[float] = mapped_column(Float, default=0)
    benchmark_win_rate: Mapped[float] = mapped_column(Float, default=0)
    relative_quality_score: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))

