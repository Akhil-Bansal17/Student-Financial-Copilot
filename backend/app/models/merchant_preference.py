import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class MerchantCategoryPreference(Base):
    """
    User-specific merchant-to-category mapping preference.
    Ensures deterministic, auditable overrides so user corrections
    take precedence over generic heuristic categorization.
    """
    __tablename__ = "merchant_category_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "normalized_merchant", name="uq_user_merchant_preference"),
        Index("ix_user_merchant_pref", "user_id", "normalized_merchant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    normalized_merchant: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
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

    user: Mapped["User"] = relationship("User", back_populates="merchant_preferences")

    def __repr__(self) -> str:
        return f"<MerchantCategoryPreference user_id={self.user_id} merchant='{self.normalized_merchant}' category='{self.category}'>"
