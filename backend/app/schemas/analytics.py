from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class FinancialSummaryResponse(BaseModel):
    starting_balance: Decimal
    current_balance: Decimal
    total_income: Decimal
    total_expenses: Decimal
    net_cash_flow: Decimal
    income_transaction_count: int
    expense_transaction_count: int
    currency: str = "INR"

    model_config = ConfigDict(from_attributes=True)


class MonthlyAnalyticsResponse(BaseModel):
    year: int
    month: int
    monthly_income: Decimal
    monthly_expenses: Decimal
    monthly_net_cash_flow: Decimal
    transaction_count: int
    previous_month_income: Decimal
    previous_month_expenses: Decimal
    previous_month_net_cash_flow: Decimal
    income_change_percentage: Optional[Decimal] = None
    expense_change_percentage: Optional[Decimal] = None
    net_cash_flow_change_percentage: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class CategorySpendingItem(BaseModel):
    category: str
    amount: Decimal
    percentage: Decimal
    transaction_count: int

    model_config = ConfigDict(from_attributes=True)


class CategorySpendingResponse(BaseModel):
    year: int
    month: int
    total_expenses: Decimal
    items: List[CategorySpendingItem]

    model_config = ConfigDict(from_attributes=True)


class IncomeCategoryItem(BaseModel):
    category: str
    amount: Decimal
    percentage: Decimal
    transaction_count: int

    model_config = ConfigDict(from_attributes=True)


class IncomeCategoryResponse(BaseModel):
    year: int
    month: int
    total_income: Decimal
    items: List[IncomeCategoryItem]

    model_config = ConfigDict(from_attributes=True)


class DailyTrendItem(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    income: Decimal
    expenses: Decimal
    net: Decimal

    model_config = ConfigDict(from_attributes=True)


class DailyTrendResponse(BaseModel):
    year: int
    month: int
    days: List[DailyTrendItem]

    model_config = ConfigDict(from_attributes=True)
