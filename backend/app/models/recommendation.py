from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedText


class RecommendationRecord(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    recommendation_data: Mapped[str] = mapped_column(EncryptedText(fallback="{}"))
    confidence_score: Mapped[int] = mapped_column(Integer)
    generated_at: Mapped[str] = mapped_column(String)
