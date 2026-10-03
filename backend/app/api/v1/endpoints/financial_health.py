from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.financial_health import (
    FinancialHealthResponse,
    SmartActionsResponse,
)
from app.services.financial_health_service import FinancialHealthService

router = APIRouter(prefix="/financial-health", tags=["Financial Health & Smart Action Center"])


@router.get("", response_model=FinancialHealthResponse, status_code=status.HTTP_200_OK)
def get_financial_health_assessment(
    year: Optional[int] = Query(None, description="Assessment year (defaults to current year)"),
    month: Optional[int] = Query(None, description="Assessment month (1-12, defaults to current month)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FinancialHealthResponse:
    """
    Get comprehensive deterministic evidence-backed Financial Health Assessment
    for the authenticated student. Enforces strict user tenant isolation.
    """
    return FinancialHealthService.evaluate_financial_health(
        db=db,
        user_id=current_user.id,
        year=year,
        month=month,
    )


@router.get("/actions", response_model=SmartActionsResponse, status_code=status.HTTP_200_OK)
def get_smart_actions(
    year: Optional[int] = Query(None, description="Target year"),
    month: Optional[int] = Query(None, description="Target month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SmartActionsResponse:
    """
    Get prioritized, deduplicated Smart Action Center recommendations
    strictly derived from verified financial facts.
    """
    return FinancialHealthService.get_smart_actions(
        db=db,
        user_id=current_user.id,
        year=year,
        month=month,
    )
