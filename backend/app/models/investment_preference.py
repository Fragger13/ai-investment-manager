from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InvestmentPreference(Base):
    __tablename__ = "investment_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    strategy_type: Mapped[str] = mapped_column(String(80))
    risk_level: Mapped[str] = mapped_column(String(40))
    investment_horizon: Mapped[str] = mapped_column(String(80))
