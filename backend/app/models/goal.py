from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.encrypted_types import EncryptedInt, EncryptedText


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(EncryptedText(fallback=""))
    target_amount: Mapped[int] = mapped_column(EncryptedInt())
    current_progress: Mapped[int] = mapped_column(EncryptedInt(), default=0)

    user = relationship("User", back_populates="goals")
