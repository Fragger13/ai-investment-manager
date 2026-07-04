from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedText


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    allocations: Mapped[str] = mapped_column(EncryptedText(fallback="[]"), default="[]")
    performance: Mapped[str] = mapped_column(EncryptedText(fallback="[]"), default="[]")
