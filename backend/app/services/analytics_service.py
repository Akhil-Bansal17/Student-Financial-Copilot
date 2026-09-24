import calendar
import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
import sqlalchemy as sa
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction
from app.schemas.analytics import (
    FinancialSummaryResponse,
    MonthlyAnalyticsResponse,
    CategorySpendingResponse,
    CategorySpendingItem,
    IncomeCategoryResponse,
    IncomeCategoryItem,
    DailyTrendResponse,
    DailyTrendItem,
)


def get_month_date_range(year: int, month: int) -> Tuple[datetime.datetime, datetime.datetime, int]:
    """
    Return (start_datetime, end_datetime, days_in_month) for the given year and month in UTC.
    The half-open interval [start_dt, end_dt) strictly covers the entire month.
    """
    start_dt = datetime.datetime(year, month, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    days_in_month = calendar.monthrange(year, month)[1]
    if month == 12:
        end_dt = datetime.datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    else:
        end_dt = datetime.datetime(year, month + 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
    return start_dt, end_dt, days_in_month


def get_previous_month_year(year: int, month: int) -> Tuple[int, int]:
    """Return (prev_year, prev_month)."""
    if month == 1:
        return year - 1, 12
    return year, month - 1


def calculate_percentage_change(current: Decimal, previous: Decimal) -> Optional[Decimal]:
    """
    Safely calculate percentage change: ((current - previous) / previous) * 100.
    If previous is zero or non-positive, comparison is mathematically undefined / not meaningful, return None.
    """
    if previous <= Decimal("0.00"):
        return None
    pct = ((current - previous) / previous) * Decimal("100")
    return pct.quantize(Decimal("0.1"))


def calculate_net_cash_flow_change(current_net: Decimal, previous_net: Decimal) -> Optional[Decimal]:
    """
    Calculate net cash flow percentage change using absolute denominator if previous is non-zero.
    If previous is zero, return None.
    """
    if previous_net == Decimal("0.00"):
        return None
    pct = ((current_net - previous_net) / abs(previous_net)) * Decimal("100")
    return pct.quantize(Decimal("0.1"))


class AnalyticsService:
    @staticmethod
    def get_summary(db: Session, user_id: int) -> FinancialSummaryResponse:
        """
        Compute overall financial summary for the authenticated user:
        - starting_balance from FinancialProfile (defaults to 0.00 if missing)
        - total_income (sum of income transactions)
        - total_expenses (sum of expense transactions)
        - net_cash_flow = total_income - total_expenses
        - current_balance = starting_balance + total_income - total_expenses
        - transaction counts
        """
        profile = (
            db.query(FinancialProfile)
            .filter(FinancialProfile.user_id == user_id)
            .first()
        )
        starting_balance = (
            Decimal(profile.starting_balance).quantize(Decimal("0.01"))
            if profile and profile.starting_balance is not None
            else Decimal("0.00")
        )

        rows = (
            db.query(
                Transaction.transaction_type,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total"),
                func.count(Transaction.id).label("count"),
            )
            .filter(Transaction.user_id == user_id)
            .group_by(Transaction.transaction_type)
            .all()
        )

        total_income = Decimal("0.00")
        total_expenses = Decimal("0.00")
        income_count = 0
        expense_count = 0

        for row in rows:
            if row.transaction_type == "income":
                total_income = Decimal(row.total).quantize(Decimal("0.01"))
                income_count = row.count
            elif row.transaction_type == "expense":
                total_expenses = Decimal(row.total).quantize(Decimal("0.01"))
                expense_count = row.count

        net_cash_flow = (total_income - total_expenses).quantize(Decimal("0.01"))
        current_balance = (starting_balance + net_cash_flow).quantize(Decimal("0.01"))

        return FinancialSummaryResponse(
            starting_balance=starting_balance,
            current_balance=current_balance,
            total_income=total_income,
            total_expenses=total_expenses,
            net_cash_flow=net_cash_flow,
            income_transaction_count=income_count,
            expense_transaction_count=expense_count,
            currency="INR",
        )

    @staticmethod
    def get_monthly_analytics(
        db: Session, user_id: int, year: int, month: int
    ) -> MonthlyAnalyticsResponse:
        """
        Compute monthly income, expenses, net cash flow and MoM comparison with previous month.
        """
        start_dt, end_dt, _ = get_month_date_range(year, month)
        prev_year, prev_month = get_previous_month_year(year, month)
        prev_start_dt, prev_end_dt, _ = get_month_date_range(prev_year, prev_month)

        # Current month query
        curr_rows = (
            db.query(
                Transaction.transaction_type,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total"),
                func.count(Transaction.id).label("count"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start_dt,
                Transaction.transaction_date < end_dt,
            )
            .group_by(Transaction.transaction_type)
            .all()
        )

        monthly_income = Decimal("0.00")
        monthly_expenses = Decimal("0.00")
        tx_count = 0

        for row in curr_rows:
            tx_count += row.count
            if row.transaction_type == "income":
                monthly_income = Decimal(row.total).quantize(Decimal("0.01"))
            elif row.transaction_type == "expense":
                monthly_expenses = Decimal(row.total).quantize(Decimal("0.01"))

        monthly_net_cash_flow = (monthly_income - monthly_expenses).quantize(Decimal("0.01"))

        # Previous month query
        prev_rows = (
            db.query(
                Transaction.transaction_type,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("total"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= prev_start_dt,
                Transaction.transaction_date < prev_end_dt,
            )
            .group_by(Transaction.transaction_type)
            .all()
        )

        prev_income = Decimal("0.00")
        prev_expenses = Decimal("0.00")

        for row in prev_rows:
            if row.transaction_type == "income":
                prev_income = Decimal(row.total).quantize(Decimal("0.01"))
            elif row.transaction_type == "expense":
                prev_expenses = Decimal(row.total).quantize(Decimal("0.01"))

        prev_net = (prev_income - prev_expenses).quantize(Decimal("0.01"))

        # MoM calculations
        income_change_pct = calculate_percentage_change(monthly_income, prev_income)
        expense_change_pct = calculate_percentage_change(monthly_expenses, prev_expenses)
        net_change_pct = calculate_net_cash_flow_change(monthly_net_cash_flow, prev_net)

        return MonthlyAnalyticsResponse(
            year=year,
            month=month,
            monthly_income=monthly_income,
            monthly_expenses=monthly_expenses,
            monthly_net_cash_flow=monthly_net_cash_flow,
            transaction_count=tx_count,
            previous_month_income=prev_income,
            previous_month_expenses=prev_expenses,
            previous_month_net_cash_flow=prev_net,
            income_change_percentage=income_change_pct,
            expense_change_percentage=expense_change_pct,
            net_cash_flow_change_percentage=net_change_pct,
        )

    @staticmethod
    def get_category_spending(
        db: Session, user_id: int, year: int, month: int
    ) -> CategorySpendingResponse:
        """
        Return expense totals grouped by category for the given month.
        Sorted by amount descending.
        """
        start_dt, end_dt, _ = get_month_date_range(year, month)

        rows = (
            db.query(
                Transaction.category,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("amount"),
                func.count(Transaction.id).label("count"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "expense",
                Transaction.transaction_date >= start_dt,
                Transaction.transaction_date < end_dt,
            )
            .group_by(Transaction.category)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )

        total_expenses = sum((Decimal(r.amount) for r in rows), Decimal("0.00")).quantize(Decimal("0.01"))

        items: List[CategorySpendingItem] = []
        if total_expenses > Decimal("0.00"):
            for r in rows:
                amt = Decimal(r.amount).quantize(Decimal("0.01"))
                pct = ((amt / total_expenses) * Decimal("100")).quantize(Decimal("0.1"))
                items.append(
                    CategorySpendingItem(
                        category=r.category,
                        amount=amt,
                        percentage=pct,
                        transaction_count=r.count,
                    )
                )

        return CategorySpendingResponse(
            year=year,
            month=month,
            total_expenses=total_expenses,
            items=items,
        )

    @staticmethod
    def get_income_categories(
        db: Session, user_id: int, year: int, month: int
    ) -> IncomeCategoryResponse:
        """
        Return income totals grouped by category for the given month.
        Sorted by amount descending.
        """
        start_dt, end_dt, _ = get_month_date_range(year, month)

        rows = (
            db.query(
                Transaction.category,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("amount"),
                func.count(Transaction.id).label("count"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "income",
                Transaction.transaction_date >= start_dt,
                Transaction.transaction_date < end_dt,
            )
            .group_by(Transaction.category)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )

        total_income = sum((Decimal(r.amount) for r in rows), Decimal("0.00")).quantize(Decimal("0.01"))

        items: List[IncomeCategoryItem] = []
        if total_income > Decimal("0.00"):
            for r in rows:
                amt = Decimal(r.amount).quantize(Decimal("0.01"))
                pct = ((amt / total_income) * Decimal("100")).quantize(Decimal("0.1"))
                items.append(
                    IncomeCategoryItem(
                        category=r.category,
                        amount=amt,
                        percentage=pct,
                        transaction_count=r.count,
                    )
                )

        return IncomeCategoryResponse(
            year=year,
            month=month,
            total_income=total_income,
            items=items,
        )

    @staticmethod
    def get_daily_trend(
        db: Session, user_id: int, year: int, month: int
    ) -> DailyTrendResponse:
        """
        Return daily income, expenses, and net values for every single day in the selected month.
        Missing days are padded with zero values to support continuous rendering.
        """
        start_dt, end_dt, days_in_month = get_month_date_range(year, month)

        tx_day_col = sa.cast(Transaction.transaction_date, sa.Date)

        rows = (
            db.query(
                tx_day_col.label("tx_day"),
                Transaction.transaction_type,
                func.coalesce(func.sum(Transaction.amount), Decimal("0.00")).label("amount"),
            )
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start_dt,
                Transaction.transaction_date < end_dt,
            )
            .group_by(tx_day_col, Transaction.transaction_type)
            .all()
        )

        # Map (date, type) -> amount
        data_map: Dict[Tuple[datetime.date, str], Decimal] = {}
        for r in rows:
            day_val = r.tx_day
            if isinstance(day_val, str):
                day_val = datetime.date.fromisoformat(day_val)
            data_map[(day_val, r.transaction_type)] = Decimal(r.amount)

        daily_items: List[DailyTrendItem] = []
        for day in range(1, days_in_month + 1):
            cur_date = datetime.date(year, month, day)
            date_str = cur_date.strftime("%Y-%m-%d")
            inc = data_map.get((cur_date, "income"), Decimal("0.00")).quantize(Decimal("0.01"))
            exp = data_map.get((cur_date, "expense"), Decimal("0.00")).quantize(Decimal("0.01"))
            net = (inc - exp).quantize(Decimal("0.01"))
            daily_items.append(
                DailyTrendItem(
                    date=date_str,
                    income=inc,
                    expenses=exp,
                    net=net,
                )
            )

        return DailyTrendResponse(
            year=year,
            month=month,
            days=daily_items,
        )
