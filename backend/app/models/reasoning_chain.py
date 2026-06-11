from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReasoningChain(Base):
    __tablename__ = "reasoning_chains"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    recommendation_key: Mapped[str] = mapped_column(String(240), index=True)
    instrument_name: Mapped[str] = mapped_column(String(240), index=True)
    chain_json: Mapped[str] = mapped_column(String, default="[]")
    final_summary: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
