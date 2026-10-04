import datetime
from typing import Optional, Any, TYPE_CHECKING
from sqlalchemy import (
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Notification(Base):
    """
    Persistent in-app notification representing an authoritative, evidence-backed financial event.
    Deduplication is guaranteed via (user_id, dedupe_key) unique constraint.
    """
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("user_id", "dedupe_key", name="uq_user_notification_dedupe"),
        Index("ix_notifications_user_unread", "user_id", "is_read", "created_at"),
        Index("ix_notifications_user_type", "user_id", "notification_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    priority: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        index=True,
        default="INFO",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    entity_type: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    action_url: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    dedupe_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    read_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
        index=True,
    )
    expires_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    metadata_json: Mapped[Optional[Any]] = mapped_column(
        JSON,
        nullable=True,
    )

    user: Mapped["User"] = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} type={self.notification_type} priority={self.priority} read={self.is_read}>"
