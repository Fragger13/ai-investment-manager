from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ResearchSource(Base):
    __tablename__ = "research_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    source_type: Mapped[str] = mapped_column(String(40), index=True)
    base_url: Mapped[str] = mapped_column(String(500))
    reliability_score: Mapped[int] = mapped_column(Integer)
    allowed_ingestion_method: Mapped[str] = mapped_column(String(80))
    refresh_frequency: Mapped[str] = mapped_column(String(80))
    categories_covered: Mapped[str] = mapped_column(String, default="[]")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
