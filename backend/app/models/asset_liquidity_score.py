from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetLiquidityScore(Base):
    __tablename__ = "asset_liquidity_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_symbol: Mapped[str] = mapped_column(String(40), index=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    market_cap_tier: Mapped[str] = mapped_column(String(40), default="unknown")
    volume_score: Mapped[int] = mapped_column(Integer, default=50)
    liquidity_score: Mapped[int] = mapped_column(Integer, default=50)
    minimum_liquidity_passed: Mapped[str] = mapped_column(String(10), default="no")
    liquidity_notes: Mapped[str] = mapped_column(String, default="")
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    retrieved_at: Mapped[str] = mapped_column(String(80))
