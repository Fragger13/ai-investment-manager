from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RegimeBacktestResult(Base):
    __tablename__ = "regime_backtest_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    strategy_type: Mapped[str] = mapped_column(String(80), index=True)
    market_regime: Mapped[str] = mapped_column(String(100), index=True)
    asset_class: Mapped[str] = mapped_column(String(100), default="")
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[float] = mapped_column(Float, default=0)
    average_return: Mapped[float] = mapped_column(Float, default=0)
    max_drawdown: Mapped[float] = mapped_column(Float, default=0)
    reliability_score: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))

