from decimal import Decimal
import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, Numeric, Boolean, DateTime, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class FinancialProfile(Base):
    __tablename__ = "financial_profiles"
    __table_args__ = (
        CheckConstraint("starting_balance >= 0", name="check_starting_balance_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    starting_balance: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        default=Decimal("0.00"),
        nullable=False,
    )
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    money_sources: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    financial_focus: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
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

    user: Mapped["User"] = relationship("User", back_populates="financial_profile")

    def __repr__(self) -> str:
        return f"<FinancialProfile id={self.id} user_id={self.user_id} completed={self.onboarding_completed}>"
