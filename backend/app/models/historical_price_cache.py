from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class HistoricalPriceCache(Base):
    __tablename__ = "historical_price_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_symbol: Mapped[str] = mapped_column(String(60), index=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    asset_type: Mapped[str] = mapped_column(String(100), default="")
    closes_json: Mapped[str] = mapped_column(String, default="[]")
    volumes_json: Mapped[str] = mapped_column(String, default="[]")
    data_mode: Mapped[str] = mapped_column(String(40), default="limited")
    source_url: Mapped[str] = mapped_column(String(800), default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))

