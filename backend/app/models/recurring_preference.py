import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class RecurringPreference(Base):
    """
    User-specific recurring merchant preference override.
    Allows students to explicitly mark a merchant as IGNORE (not recurring),
    RECURRING, SUBSCRIPTION, or BILL, ensuring deterministic control.
    """
    __tablename__ = "recurring_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "normalized_merchant", name="uq_user_recurring_preference"),
        Index("ix_user_recurring_pref", "user_id", "normalized_merchant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    normalized_merchant: Mapped[str] = mapped_column(String(100), nullable=False)
    preference_type: Mapped[str] = mapped_column(String(30), nullable=False)  # IGNORE, RECURRING, SUBSCRIPTION, BILL
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

    user: Mapped["User"] = relationship("User", back_populates="recurring_preferences")

    def __repr__(self) -> str:
        return f"<RecurringPreference user_id={self.user_id} merchant='{self.normalized_merchant}' pref='{self.preference_type}'>"
