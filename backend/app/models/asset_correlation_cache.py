from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetCorrelationCache(Base):
    __tablename__ = "asset_correlation_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_a: Mapped[str] = mapped_column(String(80), index=True)
    asset_b: Mapped[str] = mapped_column(String(80), index=True)
    correlation: Mapped[int] = mapped_column(Integer, default=0)
    data_mode: Mapped[str] = mapped_column(String(40), default="assumption")
    source: Mapped[str] = mapped_column(String(160), default="assumption model")
    retrieved_at: Mapped[str] = mapped_column(String(80))
