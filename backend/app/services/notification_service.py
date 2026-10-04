import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationPriority,
)
from app.services.smart_alert_service import SmartAlertService


class NotificationService:
    """Provides notification lifecycle management, querying, pagination, and preferences."""

    @classmethod
    def get_notifications(
        cls,
        db: Session,
        user_id: int,
        is_read: Optional[bool] = None,
        priority: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> NotificationListResponse:
        now = datetime.datetime.now(datetime.timezone.utc)
        page = max(1, page)
        page_size = max(1, min(page_size, 100))

        # Base query filtered by user_id and active non-expired notifications
        query = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                or_(Notification.expires_at.is_(None), Notification.expires_at > now),
            )
        )

        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)

        if priority is not None:
            query = query.filter(Notification.priority == priority.upper())

        total_count = query.count()
        unread_count = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
                or_(Notification.expires_at.is_(None), Notification.expires_at > now),
            )
            .count()
        )

        offset = (page - 1) * page_size
        items = (
            query.order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

        return NotificationListResponse(
            items=[NotificationResponse.model_validate(n) for n in items],
            total_count=total_count,
            unread_count=unread_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    @classmethod
    def get_unread_count(cls, db: Session, user_id: int) -> UnreadCountResponse:
        now = datetime.datetime.now(datetime.timezone.utc)
        base_unread = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
                or_(Notification.expires_at.is_(None), Notification.expires_at > now),
            )
        )

        total_unread = base_unread.count()
        critical_count = base_unread.filter(Notification.priority == NotificationPriority.CRITICAL.value).count()
        high_count = base_unread.filter(Notification.priority == NotificationPriority.HIGH.value).count()

        return UnreadCountResponse(
            unread_count=total_unread,
            critical_count=critical_count,
            high_count=high_count,
        )

    @classmethod
    def mark_as_read(cls, db: Session, user_id: int, notification_id: int) -> NotificationResponse:
        notif = (
            db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
            .first()
        )

        if not notif:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        if not notif.is_read:
            notif.is_read = True
            notif.read_at = datetime.datetime.now(datetime.timezone.utc)
            db.commit()
            db.refresh(notif)

        return NotificationResponse.model_validate(notif)

    @classmethod
    def mark_all_as_read(cls, db: Session, user_id: int) -> int:
        now = datetime.datetime.now(datetime.timezone.utc)
        unread_notifs = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .all()
        )

        count = len(unread_notifs)
        for n in unread_notifs:
            n.is_read = True
            n.read_at = now

        if count > 0:
            db.commit()

        return count

    @classmethod
    def get_preferences(cls, db: Session, user_id: int) -> NotificationPreferenceResponse:
        pref = SmartAlertService.get_or_create_preference(db, user_id)
        return NotificationPreferenceResponse.model_validate(pref)

    @classmethod
    def update_preferences(
        cls,
        db: Session,
        user_id: int,
        payload: NotificationPreferenceUpdate,
    ) -> NotificationPreferenceResponse:
        pref = SmartAlertService.get_or_create_preference(db, user_id)
        update_data = payload.model_dump(exclude_unset=True)

        for key, val in update_data.items():
            if val is not None and hasattr(pref, key):
                setattr(pref, key, val)

        pref.updated_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(pref)

        return NotificationPreferenceResponse.model_validate(pref)

    @classmethod
    def cleanup_expired_notifications(cls, db: Session, retention_days: int = 30) -> int:
        """
        Removes expired notifications that have already passed their expiration date
        or are older than retention_days, preserving important unread items.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        cutoff = now - datetime.timedelta(days=retention_days)

        # Only delete read notifications or expired non-critical/high notifications
        expired = (
            db.query(Notification)
            .filter(
                Notification.is_read.is_(True),
                or_(
                    Notification.expires_at < now,
                    Notification.created_at < cutoff,
                ),
            )
            .all()
        )

        count = len(expired)
        for n in expired:
            db.delete(n)

        if count > 0:
            db.commit()

        return count
