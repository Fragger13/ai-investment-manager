from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RecommendationEvidenceLink(Base):
    __tablename__ = "recommendation_evidence_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    recommendation_id: Mapped[int] = mapped_column(ForeignKey("recommendations.id"), index=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence_items.id"), index=True)
    link_type: Mapped[str] = mapped_column(String(80), default="supporting")
