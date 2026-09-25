from decimal import Decimal
import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Numeric, DateTime, Date, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="check_goal_target_amount_positive"),
        CheckConstraint("current_amount >= 0", name="check_goal_current_amount_non_negative"),
        CheckConstraint("current_amount <= target_amount", name="check_goal_current_amount_le_target"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=False,
    )
    current_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        default=Decimal("0.00"),
        nullable=False,
    )
    target_date: Mapped[Optional[datetime.date]] = mapped_column(
        Date,
        nullable=True,
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

    user: Mapped["User"] = relationship("User", back_populates="goals")
    contributions: Mapped[list["GoalContribution"]] = relationship(
        "GoalContribution",
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="GoalContribution.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Goal id={self.id} user_id={self.user_id} name='{self.name}' target={self.target_amount} current={self.current_amount}>"


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="check_contribution_amount_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    goal_id: Mapped[int] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=False,
    )
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    goal: Mapped["Goal"] = relationship("Goal", back_populates="contributions")
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<GoalContribution id={self.id} goal_id={self.goal_id} amount={self.amount}>"
