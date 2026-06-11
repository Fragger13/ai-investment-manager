from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SignalValidationResult(Base):
    __tablename__ = "signal_validation_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    signal_type: Mapped[str] = mapped_column(String(100), index=True)
    asset_class: Mapped[str] = mapped_column(String(100), default="")
    market_regime: Mapped[str] = mapped_column(String(100), default="")
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    reliability_score: Mapped[int] = mapped_column(Integer, default=0)
    contradiction_score: Mapped[int] = mapped_column(Integer, default=0)
    average_forward_return: Mapped[float] = mapped_column(Float, default=0)
    hit_rate: Mapped[float] = mapped_column(Float, default=0)
    signal_decay: Mapped[float] = mapped_column(Float, default=0)
    confidence_label: Mapped[str] = mapped_column(String(40), default="low")
    notes: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))

