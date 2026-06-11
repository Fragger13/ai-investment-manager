from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StrategyBacktest(Base):
    __tablename__ = "strategy_backtests"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_symbol: Mapped[str] = mapped_column(String(60), index=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    asset_type: Mapped[str] = mapped_column(String(100), default="")
    strategy_type: Mapped[str] = mapped_column(String(80), index=True)
    validation_period: Mapped[str] = mapped_column(String(80), default="1y daily")
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[float] = mapped_column(Float, default=0)
    average_return: Mapped[float] = mapped_column(Float, default=0)
    median_return: Mapped[float] = mapped_column(Float, default=0)
    volatility: Mapped[float] = mapped_column(Float, default=0)
    max_drawdown: Mapped[float] = mapped_column(Float, default=0)
    downside_deviation: Mapped[float] = mapped_column(Float, default=0)
    sharpe_like: Mapped[float] = mapped_column(Float, default=0)
    hit_rate: Mapped[float] = mapped_column(Float, default=0)
    signal_decay: Mapped[float] = mapped_column(Float, default=0)
    holding_period_days: Mapped[int] = mapped_column(Integer, default=63)
    quality_score: Mapped[int] = mapped_column(Integer, default=0)
    confidence_interval: Mapped[str] = mapped_column(String(120), default="")
    best_regime: Mapped[str] = mapped_column(String(80), default="limited data")
    weakest_regime: Mapped[str] = mapped_column(String(80), default="limited data")
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    notes: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))

