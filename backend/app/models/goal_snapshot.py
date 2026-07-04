from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedInt, EncryptedText


class GoalSnapshot(Base):
    __tablename__ = "goal_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    goals_json: Mapped[str] = mapped_column(EncryptedText(fallback="[]"), default="[]")
    goal_count: Mapped[int] = mapped_column(Integer, default=0)
    total_funding_gap: Mapped[int] = mapped_column(EncryptedInt(), default=0)
    highest_priority_goal: Mapped[str] = mapped_column(EncryptedText(fallback=""), default="")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
