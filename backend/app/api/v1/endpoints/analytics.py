import datetime
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    FinancialSummaryResponse,
    MonthlyAnalyticsResponse,
    CategorySpendingResponse,
    IncomeCategoryResponse,
    DailyTrendResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter()


def resolve_year_month(year: Optional[int], month: Optional[int]) -> tuple[int, int]:
    now = datetime.datetime.now(datetime.timezone.utc)
    target_year = year if year is not None else now.year
    target_month = month if month is not None else now.month
    return target_year, target_month


@router.get("/summary", response_model=FinancialSummaryResponse)
def get_financial_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get all-time financial summary:
    - starting_balance
    - current_balance
    - total_income
    - total_expenses
    - net_cash_flow
    - income_transaction_count
    - expense_transaction_count
    """
    return AnalyticsService.get_summary(db=db, user_id=current_user.id)


@router.get("/monthly", response_model=MonthlyAnalyticsResponse)
def get_monthly_analytics(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(default=None, ge=1900, le=2200, description="Calendar year"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Calendar month (1-12)"),
):
    """
    Get monthly analytics and month-over-month comparisons with the previous month.
    """
    y, m = resolve_year_month(year, month)
    return AnalyticsService.get_monthly_analytics(db=db, user_id=current_user.id, year=y, month=m)


@router.get("/categories", response_model=CategorySpendingResponse)
def get_category_spending(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(default=None, ge=1900, le=2200, description="Calendar year"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Calendar month (1-12)"),
):
    """
    Get expense totals grouped by category for the selected month.
    """
    y, m = resolve_year_month(year, month)
    return AnalyticsService.get_category_spending(db=db, user_id=current_user.id, year=y, month=m)


@router.get("/income-categories", response_model=IncomeCategoryResponse)
def get_income_categories(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(default=None, ge=1900, le=2200, description="Calendar year"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Calendar month (1-12)"),
):
    """
    Get income totals grouped by category for the selected month.
    """
    y, m = resolve_year_month(year, month)
    return AnalyticsService.get_income_categories(db=db, user_id=current_user.id, year=y, month=m)


@router.get("/trend", response_model=DailyTrendResponse)
def get_daily_trend(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(default=None, ge=1900, le=2200, description="Calendar year"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Calendar month (1-12)"),
):
    """
    Get continuous daily spending and income trend for all days in the selected month.
    """
    y, m = resolve_year_month(year, month)
    return AnalyticsService.get_daily_trend(db=db, user_id=current_user.id, year=y, month=m)
