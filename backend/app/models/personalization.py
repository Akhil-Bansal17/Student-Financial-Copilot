import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    Integer,
    String,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class PersonalizationProfile(Base):
    """
    User-specific personalization profile and adaptive intelligence settings.
    Maintains explicit preferences such as alert sensitivity, financial priority,
    custom large transaction threshold, and recurring alert lead times.
    """
    __tablename__ = "personalization_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_personalization_profile"),
        Index("ix_personalization_profiles_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    is_personalization_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    # Sensitivity levels: CONSERVATIVE, BALANCED, RELAXED
    alert_sensitivity: Mapped[str] = mapped_column(
        String(32),
        default="BALANCED",
        nullable=False,
    )
    # Financial priorities: SAVE_MORE, CONTROL_SPENDING, STAY_WITHIN_BUDGET, BUILD_BUFFER, REACH_GOALS, UNDERSTAND_SPENDING, BALANCED
    financial_priority: Mapped[str] = mapped_column(
        String(64),
        default="BALANCED",
        nullable=False,
    )
    # User-defined large transaction threshold (None = system calculates personal baseline)
    large_transaction_threshold: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=True,
        default=None,
    )
    # How many days before expected payment to receive recurring alerts: 1, 3, 5, or 7
    recurring_alert_days_before: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
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

    user: Mapped["User"] = relationship("User", back_populates="personalization_profile")

    def __repr__(self) -> str:
        return (
            f"<PersonalizationProfile id={self.id} user_id={self.user_id} "
            f"priority='{self.financial_priority}' sensitivity='{self.alert_sensitivity}'>"
        )
