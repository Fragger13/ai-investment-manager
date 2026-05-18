from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ResearchArticle(Base):
    __tablename__ = "research_articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("research_sources.id"), nullable=True)
    source_name: Mapped[str] = mapped_column(String(120), index=True)
    source_url: Mapped[str] = mapped_column(String(800), index=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(String, default="")
    raw_text: Mapped[str] = mapped_column(String, default="")
    published_at: Mapped[str] = mapped_column(String(80), default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
    credibility_score: Mapped[int] = mapped_column(Integer, default=50)
    extraction_mode: Mapped[str] = mapped_column(String(40), default="fallback")
