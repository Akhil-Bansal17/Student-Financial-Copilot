from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.forecast import (
    CashFlowForecastResponse,
    ForecastSummaryResponse,
    ForecastTimelineResponse,
    ForecastPreferenceResponse,
    ForecastPreferenceUpdate,
)
from app.services.cash_flow_forecast_service import CashFlowForecastService

router = APIRouter(prefix="/forecast", tags=["Cash Flow Forecasting & Financial Planning"])


@router.get("", response_model=CashFlowForecastResponse)
def get_cash_flow_forecast(
    days: int = Query(30, description="Forecast horizon in days (7, 30, 90)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive deterministic cash flow forecast for the authenticated user
    over the requested horizon (7, 30, or 90 days).
    Enforces strict user isolation.
    """
    return CashFlowForecastService.compute_cash_flow_forecast(
        db=db,
        user_id=current_user.id,
        days=days,
    )


@router.get("/summary", response_model=ForecastSummaryResponse)
def get_forecast_summary(
    days: int = Query(30, description="Forecast horizon in days (7, 30, 90)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get lightweight summary of cash flow projections, data sufficiency, and balance alerts.
    """
    return CashFlowForecastService.get_summary(
        db=db,
        user_id=current_user.id,
        days=days,
    )


@router.get("/timeline", response_model=ForecastTimelineResponse)
def get_forecast_timeline(
    days: int = Query(30, description="Forecast horizon in days (7, 30, 90)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get chronological projected cash-flow timeline of expected income, recurring commitments,
    and discretionary checkpoints.
    """
    return CashFlowForecastService.get_timeline(
        db=db,
        user_id=current_user.id,
        days=days,
    )


@router.get("/preference", response_model=ForecastPreferenceResponse)
def get_forecast_preference(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get user's configured minimum balance preference and forecast settings.
    """
    return CashFlowForecastService.get_or_create_preference(
        db=db,
        user_id=current_user.id,
    )


@router.patch("/preference", response_model=ForecastPreferenceResponse)
def update_forecast_preference(
    payload: ForecastPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update user's minimum balance preference and forecast settings.
    Enforces user isolation.
    """
    return CashFlowForecastService.update_preference(
        db=db,
        user_id=current_user.id,
        payload=payload,
    )
