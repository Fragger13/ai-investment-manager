from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortfolioValidationResult(Base):
    __tablename__ = "portfolio_validation_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_key: Mapped[str] = mapped_column(String(120), index=True)
    recommendation_count: Mapped[int] = mapped_column(Integer, default=0)
    diversification_score: Mapped[int] = mapped_column(Integer, default=0)
    concentration_score: Mapped[int] = mapped_column(Integer, default=0)
    estimated_volatility: Mapped[float] = mapped_column(Float, default=0)
    estimated_max_drawdown: Mapped[float] = mapped_column(Float, default=0)
    crypto_risk_contribution: Mapped[float] = mapped_column(Float, default=0)
    tactical_risk_contribution: Mapped[float] = mapped_column(Float, default=0)
    hidden_concentration_notes: Mapped[str] = mapped_column(String, default="")
    validation_summary: Mapped[str] = mapped_column(String, default="")
    retrieved_at: Mapped[str] = mapped_column(String(80))

