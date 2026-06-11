from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetRiskScore(Base):
    __tablename__ = "asset_risk_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_symbol: Mapped[str] = mapped_column(String(40), index=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    risk_category: Mapped[str] = mapped_column(String(40), default="medium")
    volatility_score: Mapped[int] = mapped_column(Integer, default=50)
    drawdown_score: Mapped[int] = mapped_column(Integer, default=50)
    concentration_risk: Mapped[str] = mapped_column(String(160), default="")
    suitability_risk: Mapped[str] = mapped_column(String(160), default="")
    risk_notes: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
