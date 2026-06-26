from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetResearch(Base):
    __tablename__ = "asset_research"

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_name: Mapped[str] = mapped_column(String(220), index=True)
    asset_type: Mapped[str] = mapped_column(String(80), index=True)
    category: Mapped[str] = mapped_column(String(120), default="")
    summary: Mapped[str] = mapped_column(String)
    suitability_notes: Mapped[str] = mapped_column(String, default="")
    risk_notes: Mapped[str] = mapped_column(String, default="")
    evidence_json: Mapped[str] = mapped_column(String, default="[]")
    # The chosen fund's own factor inputs (cagr/volatility from real NAV history) so
    # the expected return can be recomputed per-fund at read time — same model the
    # recommendation engine uses. Empty for non-fund assets / unresolved picks.
    return_factors_json: Mapped[str] = mapped_column(String, default="{}")
    data_mode: Mapped[str] = mapped_column(String(40), default="fallback")
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    retrieved_at: Mapped[str] = mapped_column(String(80))
