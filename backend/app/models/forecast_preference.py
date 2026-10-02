import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import Integer, Numeric, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ForecastPreference(Base):
    """
    User configuration for Cash Flow Forecasting & Financial Planning.
    Stores the user's preferred minimum balance safety threshold and preferences.
    """
    __tablename__ = "forecast_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_forecast_preference"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    minimum_balance_threshold: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=False,
        default=Decimal("2000.00"),
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="forecast_preference")

    def __repr__(self) -> str:
        return f"<ForecastPreference id={self.id} user_id={self.user_id} min_balance={self.minimum_balance_threshold}>"
