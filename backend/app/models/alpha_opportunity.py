from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AlphaOpportunity(Base):
    __tablename__ = "alpha_opportunities"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    ticker: Mapped[str] = mapped_column(String(40), default="", index=True)
    asset_type: Mapped[str] = mapped_column(String(80), default="")
    bucket: Mapped[str] = mapped_column(String(60), default="watchlist")
    non_obvious_reason: Mapped[str] = mapped_column(String, default="")
    key_signal: Mapped[str] = mapped_column(String, default="")
    supporting_signals_json: Mapped[str] = mapped_column(String, default="[]")
    conflicting_signals_json: Mapped[str] = mapped_column(String, default="[]")
    asymmetry_score: Mapped[int] = mapped_column(Integer, default=50)
    novelty_score: Mapped[int] = mapped_column(Integer, default=50)
    evidence_score: Mapped[int] = mapped_column(Integer, default=50)
    risk_adjusted_score: Mapped[int] = mapped_column(Integer, default=50)
    suggested_action: Mapped[str] = mapped_column(String(40), default="watchlist")
    allocation_cap: Mapped[int] = mapped_column(Integer, default=0)
    invalidation_trigger: Mapped[str] = mapped_column(String, default="")
    risk_label: Mapped[str] = mapped_column(String(40), default="high")
    retrieved_at: Mapped[str] = mapped_column(String(80))
