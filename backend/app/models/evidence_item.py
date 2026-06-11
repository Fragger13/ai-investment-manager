from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), index=True)
    source_url: Mapped[str] = mapped_column(String(800), index=True)
    evidence_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(500), default="")
    summary: Mapped[str] = mapped_column(String, default="")
    raw_text_allowed: Mapped[str] = mapped_column(String(10), default="no")
    credibility_score: Mapped[int] = mapped_column(Integer, default=50)
    relevance_score: Mapped[int] = mapped_column(Integer, default=50)
    recency_score: Mapped[int] = mapped_column(Integer, default=50)
    confidence_contribution: Mapped[int] = mapped_column(Integer, default=50)
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    retrieved_at: Mapped[str] = mapped_column(String(80))
