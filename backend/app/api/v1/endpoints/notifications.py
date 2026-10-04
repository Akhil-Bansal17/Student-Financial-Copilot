from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    AlertEvaluationResult,
)
from app.services.notification_service import NotificationService
from app.services.smart_alert_service import SmartAlertService

router = APIRouter(tags=["Smart Alerts & Notification Center"])


@router.get("/notifications", response_model=NotificationListResponse, status_code=status.HTTP_200_OK)
def list_notifications(
    is_read: Optional[bool] = Query(None, description="Filter by read state (true/false)"),
    priority: Optional[str] = Query(None, description="Filter by priority (CRITICAL, HIGH, MEDIUM, LOW, INFO)"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    """
    List in-app notifications for the authenticated student.
    Enforces pagination and tenant isolation.
    """
    return NotificationService.get_notifications(
        db=db,
        user_id=current_user.id,
        is_read=is_read,
        priority=priority,
        page=page,
        page_size=page_size,
    )


@router.get("/notifications/unread-count", response_model=UnreadCountResponse, status_code=status.HTTP_200_OK)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    """
    Get unread notification count, including counts of critical and high priority items,
    for updating the header notification badge.
    """
    return NotificationService.get_unread_count(
        db=db,
        user_id=current_user.id,
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse, status_code=status.HTTP_200_OK)
def mark_notification_as_read(
    notification_id: int = Path(..., ge=1, description="Notification ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    """
    Mark an individual notification as read. Enforces user ownership to prevent IDOR.
    """
    return NotificationService.mark_as_read(
        db=db,
        user_id=current_user.id,
        notification_id=notification_id,
    )


@router.post("/notifications/mark-all-read", status_code=status.HTTP_200_OK)
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Mark all unread notifications as read for the authenticated student.
    """
    count = NotificationService.mark_all_as_read(
        db=db,
        user_id=current_user.id,
    )
    return {"marked_count": count, "message": f"{count} notifications marked as read."}


@router.post("/notifications/evaluate", response_model=AlertEvaluationResult, status_code=status.HTTP_200_OK)
def evaluate_smart_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AlertEvaluationResult:
    """
    Trigger on-demand idempotent smart alert evaluation for the authenticated student.
    Evaluates verified facts, checks preferences, and deduplicates before creating notifications.
    """
    return SmartAlertService.evaluate_user_alerts(
        db=db,
        user=current_user,
    )


@router.get("/notification-preferences", response_model=NotificationPreferenceResponse, status_code=status.HTTP_200_OK)
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceResponse:
    """
    Get user-controlled notification preferences and alert category toggles.
    """
    return NotificationService.get_preferences(
        db=db,
        user_id=current_user.id,
    )


@router.patch("/notification-preferences", response_model=NotificationPreferenceResponse, status_code=status.HTTP_200_OK)
def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceResponse:
    """
    Update user-controlled notification preferences.
    Controls alert generation/suppression without affecting underlying financial calculations.
    """
    return NotificationService.update_preferences(
        db=db,
        user_id=current_user.id,
        payload=payload,
    )
