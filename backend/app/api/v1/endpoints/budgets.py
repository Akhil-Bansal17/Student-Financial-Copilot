import datetime
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.budget import (
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    BudgetSummaryResponse,
)
from app.services.budget_service import BudgetService

router = APIRouter()


def resolve_year_month(year: Optional[int], month: Optional[int]) -> tuple[int, int]:
    now = datetime.datetime.now(datetime.timezone.utc)
    target_year = year if year is not None else now.year
    target_month = month if month is not None else now.month
    return target_year, target_month


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: BudgetCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new overall or category budget for the authenticated user.
    """
    return BudgetService.create_budget(db=db, user_id=current_user.id, payload=payload)


@router.get("/summary", response_model=BudgetSummaryResponse)
def get_budget_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(default=None, ge=2000, le=2100, description="Calendar year"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Calendar month (1-12)"),
):
    """
    Get complete budget summary for the selected year and month, including overall
    and category-specific budgets, spending, remaining balance, and utilization.
    """
    target_year, target_month = resolve_year_month(year, month)
    return BudgetService.get_summary(
        db=db, user_id=current_user.id, year=target_year, month=target_month
    )


@router.get("", response_model=List[BudgetResponse])
def get_budgets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(default=None, ge=2000, le=2100, description="Optional year filter"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Optional month filter"),
):
    """
    Get all budgets configured by the authenticated user, optionally filtered by year and month.
    """
    return BudgetService.get_budgets(
        db=db, user_id=current_user.id, year=year, month=month
    )


@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(
    budget_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get an individual budget by ID strictly belonging to the authenticated user.
    """
    return BudgetService.get_budget_by_id(
        db=db, user_id=current_user.id, budget_id=budget_id
    )


@router.patch("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int,
    payload: BudgetUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update a budget strictly belonging to the authenticated user.
    """
    return BudgetService.update_budget(
        db=db, user_id=current_user.id, budget_id=budget_id, payload=payload
    )


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a budget strictly belonging to the authenticated user.
    Never deletes transactions or affects balances.
    """
    BudgetService.delete_budget(db=db, user_id=current_user.id, budget_id=budget_id)
    return {"success": True, "message": "Budget deleted successfully"}
