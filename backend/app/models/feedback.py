from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Feedback(Base):
    """User feedback — both the periodic star-rating prompt (kind="rating") and
    the Help / Contact form (kind="contact"). Stored so the owner can review it,
    and best-effort emailed on submit."""

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(40), default="contact", index=True)  # "rating" | "contact"
    category: Mapped[str] = mapped_column(String(120), default="")
    rating: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String(240), default="")
    page: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[str] = mapped_column(String(40), index=True)
