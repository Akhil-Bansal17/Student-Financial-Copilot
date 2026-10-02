import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Numeric, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class RecurringExpense(Base):
    """
    Persistent authoritative record of a verified recurring expense pattern or subscription.
    Computed deterministically from user transaction history and user overrides.
    """
    __tablename__ = "recurring_expenses"
    __table_args__ = (
        UniqueConstraint("user_id", "normalized_merchant", name="uq_user_recurring_expense"),
        Index("ix_recurring_expenses_user_status", "user_id", "status"),
        Index("ix_recurring_expenses_user_next_date", "user_id", "next_expected_date"),
        Index("ix_recurring_expenses_user_merchant", "user_id", "normalized_merchant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    merchant: Mapped[str] = mapped_column(String(100), nullable=False)
    normalized_merchant: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    recurring_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="RECURRING_EXPENSE",
        server_default="RECURRING_EXPENSE",
    )  # SUBSCRIPTION, RECURRING_BILL, RECURRING_EXPENSE, RECURRING_OTHER
    frequency: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="MONTHLY",
        server_default="MONTHLY",
    )  # WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY
    is_variable_amount: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="HIGH",
        server_default="HIGH",
    )  # HIGH, MEDIUM, LOW
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )  # ACTIVE, OVERDUE_EXPECTED, POSSIBLY_ENDED, PAUSED, USER_IGNORED

    # Financial figures
    average_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    latest_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    previous_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    min_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    max_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_change: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    amount_change_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)

    # Historical timeline & projections
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_occurrence_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    next_expected_date: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

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

    user: Mapped["User"] = relationship("User", back_populates="recurring_expenses")

    def __repr__(self) -> str:
        return f"<RecurringExpense id={self.id} user_id={self.user_id} merchant='{self.normalized_merchant}' freq={self.frequency} amount={self.latest_amount}>"
