from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedText


class BehavioralSnapshot(Base):
    __tablename__ = "behavioral_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    snapshot_json: Mapped[str] = mapped_column(EncryptedText(fallback="{}"), default="{}")
    savings_rate: Mapped[int] = mapped_column(Integer, default=0)
    emi_burden: Mapped[int] = mapped_column(Integer, default=0)
    risk_taking_score: Mapped[int] = mapped_column(Integer, default=0)
    consistency_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(String(80), index=True)
