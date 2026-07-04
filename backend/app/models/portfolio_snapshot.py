from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedInt, EncryptedText


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(80), default="optimizer")
    snapshot_json: Mapped[str] = mapped_column(EncryptedText(fallback="{}"), default="{}")
    total_value: Mapped[int] = mapped_column(EncryptedInt(), default=0)
    allocation_drift: Mapped[int] = mapped_column(Integer, default=0)
    concentration_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_exposure: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[str] = mapped_column(String(80), index=True)
