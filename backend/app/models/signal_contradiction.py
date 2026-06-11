from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SignalContradiction(Base):
    __tablename__ = "signal_contradictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("market_signals.id"), index=True)
    contradictory_signal_id: Mapped[int | None] = mapped_column(ForeignKey("market_signals.id"), nullable=True, index=True)
    entity: Mapped[str] = mapped_column(String(160), index=True)
    contradiction_type: Mapped[str] = mapped_column(String(80), default="sentiment_conflict")
    summary: Mapped[str] = mapped_column(String, default="")
    evidence_url: Mapped[str] = mapped_column(String(800), default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
