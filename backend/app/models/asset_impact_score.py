from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetImpactScore(Base):
    __tablename__ = "asset_impact_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    asset_type: Mapped[str] = mapped_column(String(80), default="")
    signal_id: Mapped[int | None] = mapped_column(ForeignKey("market_signals.id"), nullable=True, index=True)
    impact_score: Mapped[int] = mapped_column(Integer, default=50)
    direction: Mapped[str] = mapped_column(String(40), default="neutral")
    reason: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
