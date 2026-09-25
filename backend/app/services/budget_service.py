import calendar
import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.transaction import Transaction
from app.schemas.budget import (
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    BudgetSummaryResponse,
    CategoryBudgetSummary,
    OverallBudgetSummary,
)


def get_month_date_range(year: int, month: int) -> Tuple[datetime.datetime, datetime.datetime]:
    """
    Return (start_datetime, end_datetime) for the given year and month in UTC.
    The half-open interval [start_dt, end_dt) strictly covers the entire month.
    """
    start_dt = datetime.datetime(year, month, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    if month == 12:
        end_dt = datetime.datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    else:
        end_dt = datetime.datetime(year, month + 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    return start_dt, end_dt


class BudgetService:
    @staticmethod
    def calculate_metrics(budget_amount: Decimal, actual_spending: Decimal) -> Tuple[Decimal, Decimal, bool]:
        """
        Calculate remaining, utilization percentage, and over_budget flag.
        - remaining = budget_amount - actual_spending (allows negative values)
        - utilization_percentage = (actual_spending / budget_amount) * 100 (not capped at 100%)
        - over_budget = actual_spending > budget_amount
        """
        remaining = (budget_amount - actual_spending).quantize(Decimal("0.01"))
        if budget_amount > Decimal("0"):
            utilization = ((actual_spending / budget_amount) * Decimal("100")).quantize(Decimal("0.1"))
        else:
            utilization = Decimal("0.0")
        over_budget = actual_spending > budget_amount
        return remaining, utilization, over_budget

    @staticmethod
    def get_spending_for_month(
        db: Session,
        user_id: int,
        year: int,
        month: int,
        category: Optional[str] = None,
    ) -> Decimal:
        """
        Calculate actual expense spending for the authenticated user in the specified month.
        If category is provided, filters for that category; otherwise sums all expenses.
        """
        start_dt, end_dt = get_month_date_range(year, month)
        query = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
                Transaction.transaction_date >= start_dt,
                Transaction.transaction_date < end_dt,
            )
        )
        if category:
            query = query.filter(Transaction.category == category)

        total: Decimal = query.scalar() or Decimal("0.00")
        return Decimal(total).quantize(Decimal("0.01"))

    @staticmethod
    def get_category_spending_map(
        db: Session,
        user_id: int,
        year: int,
        month: int,
    ) -> Dict[str, Decimal]:
        """
        Return a dictionary mapping category -> actual expense spending for the given month.
        """
        start_dt, end_dt = get_month_date_range(year, month)
        results = (
            db.query(
                Transaction.category,
                func.coalesce(func.sum(Transaction.amount), 0).label("total_spent"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
                Transaction.transaction_date >= start_dt,
                Transaction.transaction_date < end_dt,
            )
            .group_by(Transaction.category)
            .all()
        )
        return {r[0]: Decimal(r[1]).quantize(Decimal("0.01")) for r in results}

    @classmethod
    def to_budget_response(cls, db: Session, budget: Budget) -> BudgetResponse:
        """
        Convert a Budget ORM instance into BudgetResponse enriched with real calculation metrics.
        """
        spending = cls.get_spending_for_month(
            db, budget.user_id, budget.year, budget.month, budget.category
        )
        remaining, utilization, over_budget = cls.calculate_metrics(budget.amount, spending)

        return BudgetResponse(
            id=budget.id,
            user_id=budget.user_id,
            year=budget.year,
            month=budget.month,
            category=budget.category,
            amount=budget.amount,
            created_at=budget.created_at,
            updated_at=budget.updated_at,
            actual_spending=spending,
            remaining=remaining,
            utilization_percentage=utilization,
            over_budget=over_budget,
        )

    @classmethod
    def create_budget(cls, db: Session, user_id: int, payload: BudgetCreate) -> BudgetResponse:
        """
        Create a new overall or category budget for the authenticated user.
        Validates duplicate constraints.
        """
        # Check duplicate
        existing = (
            db.query(Budget)
            .filter(
                Budget.user_id == user_id,
                Budget.year == payload.year,
                Budget.month == payload.month,
                Budget.category == payload.category,
            )
            .first()
        )
        if existing:
            label = f"category '{payload.category}'" if payload.category else "overall"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A budget for {label} already exists for {payload.year}-{payload.month:02d}",
            )

        budget = Budget(
            user_id=user_id,
            year=payload.year,
            month=payload.month,
            category=payload.category,
            amount=payload.amount,
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)

        return cls.to_budget_response(db, budget)

    @classmethod
    def get_budgets(
        cls,
        db: Session,
        user_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> List[BudgetResponse]:
        """
        List budgets for the authenticated user, optionally filtered by year and month.
        """
        query = db.query(Budget).filter(Budget.user_id == user_id)
        if year is not None:
            query = query.filter(Budget.year == year)
        if month is not None:
            query = query.filter(Budget.month == month)

        budgets = query.order_by(
            Budget.year.desc(),
            Budget.month.desc(),
            Budget.category.nullsfirst(),
        ).all()

        return [cls.to_budget_response(db, b) for b in budgets]

    @classmethod
    def get_budget_by_id(cls, db: Session, user_id: int, budget_id: int) -> BudgetResponse:
        """
        Get an individual budget by ID strictly belonging to authenticated user.
        """
        budget = (
            db.query(Budget)
            .filter(Budget.id == budget_id, Budget.user_id == user_id)
            .first()
        )
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Budget not found",
            )
        return cls.to_budget_response(db, budget)

    @classmethod
    def update_budget(
        cls,
        db: Session,
        user_id: int,
        budget_id: int,
        payload: BudgetUpdate,
    ) -> BudgetResponse:
        """
        Update an existing budget. Validates uniqueness if year/month/category are changed.
        """
        budget = (
            db.query(Budget)
            .filter(Budget.id == budget_id, Budget.user_id == user_id)
            .first()
        )
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Budget not found",
            )

        new_year = payload.year if payload.year is not None else budget.year
        new_month = payload.month if payload.month is not None else budget.month
        new_category = payload.category if payload.category is not None else budget.category

        if (
            new_year != budget.year
            or new_month != budget.month
            or new_category != budget.category
        ):
            # Check duplicate against other records
            duplicate = (
                db.query(Budget)
                .filter(
                    Budget.user_id == user_id,
                    Budget.year == new_year,
                    Budget.month == new_month,
                    Budget.category == new_category,
                    Budget.id != budget_id,
                )
                .first()
            )
            if duplicate:
                label = f"category '{new_category}'" if new_category else "overall"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A budget for {label} already exists for {new_year}-{new_month:02d}",
                )
            budget.year = new_year
            budget.month = new_month
            budget.category = new_category

        if payload.amount is not None:
            budget.amount = payload.amount

        db.commit()
        db.refresh(budget)
        return cls.to_budget_response(db, budget)

    @classmethod
    def delete_budget(cls, db: Session, user_id: int, budget_id: int) -> None:
        """
        Delete a budget strictly belonging to the authenticated user.
        Never affects transactions or account balances.
        """
        budget = (
            db.query(Budget)
            .filter(Budget.id == budget_id, Budget.user_id == user_id)
            .first()
        )
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Budget not found",
            )
        db.delete(budget)
        db.commit()

    @classmethod
    def get_summary(
        cls,
        db: Session,
        user_id: int,
        year: int,
        month: int,
    ) -> BudgetSummaryResponse:
        """
        Generate complete budget summary for the selected year and month:
        - Overall budget, actual total spending, remaining, utilization, over_budget
        - Category-specific budget summaries
        - Empty states handled gracefully with no fake ₹0 numbers.
        """
        budgets = (
            db.query(Budget)
            .filter(
                Budget.user_id == user_id,
                Budget.year == year,
                Budget.month == month,
            )
            .all()
        )

        spending_map = cls.get_category_spending_map(db, user_id, year, month)
        total_spent = sum(spending_map.values(), Decimal("0.00")).quantize(Decimal("0.01"))

        overall_record = next((b for b in budgets if b.category is None), None)
        category_records = [b for b in budgets if b.category is not None]

        overall_summary: Optional[OverallBudgetSummary] = None
        overall_budget_amount: Optional[Decimal] = None
        overall_budget_id: Optional[int] = None
        overall_remaining: Optional[Decimal] = None
        overall_utilization: Optional[Decimal] = None
        overall_over_budget: bool = False

        if overall_record:
            overall_budget_amount = overall_record.amount
            overall_budget_id = overall_record.id
            overall_remaining, overall_utilization, overall_over_budget = cls.calculate_metrics(
                overall_record.amount, total_spent
            )
            overall_summary = OverallBudgetSummary(
                id=overall_record.id,
                budget=overall_record.amount,
                spent=total_spent,
                remaining=overall_remaining,
                utilization=overall_utilization,
                over_budget=overall_over_budget,
            )

        category_summaries: List[CategoryBudgetSummary] = []
        for cat_b in category_records:
            cat_name = str(cat_b.category)
            cat_spent = spending_map.get(cat_name, Decimal("0.00"))
            rem, util, over = cls.calculate_metrics(cat_b.amount, cat_spent)
            category_summaries.append(
                CategoryBudgetSummary(
                    id=cat_b.id,
                    category=cat_name,
                    budget=cat_b.amount,
                    spent=cat_spent,
                    remaining=rem,
                    utilization=util,
                    over_budget=over,
                )
            )

        # Sort category summaries alphabetically by category name
        category_summaries.sort(key=lambda x: x.category)

        has_overall = overall_record is not None
        has_any = has_overall or len(category_summaries) > 0

        return BudgetSummaryResponse(
            year=year,
            month=month,
            currency="INR",
            overall_budget=overall_budget_amount,
            overall_budget_id=overall_budget_id,
            overall_spending=total_spent,
            overall_remaining=overall_remaining,
            overall_utilization=overall_utilization,
            overall_over_budget=overall_over_budget,
            overall=overall_summary,
            category_budgets=category_summaries,
            has_overall_budget=has_overall,
            total_categories_budgeted=len(category_summaries),
            has_any_budget=has_any,
        )
