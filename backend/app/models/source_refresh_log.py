from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SourceRefreshLog(Base):
    __tablename__ = "source_refresh_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), index=True)
    status: Mapped[str] = mapped_column(String(40))
    mode: Mapped[str] = mapped_column(String(40), default="fallback")
    message: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))
    items_processed: Mapped[int] = mapped_column(Integer, default=0)
