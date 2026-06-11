from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CryptoAssetResearch(Base):
    __tablename__ = "crypto_asset_research"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_name: Mapped[str] = mapped_column(String(120), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    narrative: Mapped[str] = mapped_column(String(160), default="")
    market_cap_tier: Mapped[str] = mapped_column(String(40), default="large")
    liquidity_score: Mapped[int] = mapped_column(Integer, default=50)
    volatility_score: Mapped[int] = mapped_column(Integer, default=80)
    narrative_strength: Mapped[int] = mapped_column(Integer, default=50)
    evidence_score: Mapped[int] = mapped_column(Integer, default=50)
    recommended_action: Mapped[str] = mapped_column(String(40), default="watchlist")
    allocation_cap: Mapped[int] = mapped_column(Integer, default=0)
    risk_warning: Mapped[str] = mapped_column(String, default="")
    evidence_json: Mapped[str] = mapped_column(String, default="[]")
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    retrieved_at: Mapped[str] = mapped_column(String(80))
