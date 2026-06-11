from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetSignalLink(Base):
    __tablename__ = "asset_signal_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_name: Mapped[str] = mapped_column(String(160), index=True)
    asset_type: Mapped[str] = mapped_column(String(80), default="")
    signal_id: Mapped[int] = mapped_column(ForeignKey("market_signals.id"), index=True)
    relationship: Mapped[str] = mapped_column(String(80), default="mentioned")
