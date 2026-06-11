from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TechnicalIndicator(Base):
    __tablename__ = "technical_indicators"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_symbol: Mapped[str] = mapped_column(String(40), index=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    asset_type: Mapped[str] = mapped_column(String(80), default="")
    latest_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    moving_average_20: Mapped[float | None] = mapped_column(Float, nullable=True)
    moving_average_50: Mapped[float | None] = mapped_column(Float, nullable=True)
    moving_average_200: Mapped[float | None] = mapped_column(Float, nullable=True)
    rsi: Mapped[float | None] = mapped_column(Float, nullable=True)
    macd: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_spike: Mapped[str] = mapped_column(String(80), default="limited data")
    relative_strength: Mapped[int] = mapped_column(Integer, default=50)
    volatility: Mapped[int] = mapped_column(Integer, default=50)
    support_zone: Mapped[str] = mapped_column(String(120), default="")
    resistance_zone: Mapped[str] = mapped_column(String(120), default="")
    breakout_status: Mapped[str] = mapped_column(String(80), default="limited data")
    trend_strength: Mapped[int] = mapped_column(Integer, default=50)
    drawdown: Mapped[float | None] = mapped_column(Float, nullable=True)
    buy_range: Mapped[str] = mapped_column(String(120), default="")
    review_zone: Mapped[str] = mapped_column(String(120), default="")
    stop_loss_reference: Mapped[str] = mapped_column(String(120), default="")
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    source_url: Mapped[str] = mapped_column(String(800), default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
