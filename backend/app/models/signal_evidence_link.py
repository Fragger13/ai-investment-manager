from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SignalEvidenceLink(Base):
    __tablename__ = "signal_evidence_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("market_signals.id"), index=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence_items.id"), index=True)
    link_type: Mapped[str] = mapped_column(String(80), default="supporting")
