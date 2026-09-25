from decimal import Decimal
import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.core.constants import (
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
)


def validate_positive_amount(v: Optional[Decimal]) -> Optional[Decimal]:
    if v is None:
        return v
    if v.is_nan() or v.is_infinite():
        raise ValueError("Amount must be a finite number")
    if v <= Decimal("0"):
        raise ValueError("Amount must be greater than zero")
    return v.quantize(Decimal("0.01"))


def validate_budget_category(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v_clean = v.strip()
    if not v_clean or v_clean.lower() == "overall":
        return None
    if v_clean in INCOME_CATEGORIES:
        raise ValueError(
            f"Income category '{v_clean}' cannot be used for budgets. Budgets can only be set for expense categories or Overall."
        )
    if v_clean not in EXPENSE_CATEGORIES:
        raise ValueError(
            f"Invalid budget category: '{v_clean}'. Must be one of {sorted(EXPENSE_CATEGORIES)} or empty for Overall."
        )
    return v_clean


class BudgetCreate(BaseModel):
    year: int = Field(..., ge=2000, le=2100, description="Valid calendar year")
    month: int = Field(..., ge=1, le=12, description="Month (1 to 12)")
    category: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Expense category or null/empty for overall monthly budget",
    )
    amount: Decimal = Field(..., description="Budget amount (must be positive)")

    @field_validator("amount", mode="after")
    @classmethod
    def check_amount(cls, v: Decimal) -> Decimal:
        val = validate_positive_amount(v)
        assert val is not None
        return val

    @field_validator("category", mode="after")
    @classmethod
    def check_category(cls, v: Optional[str]) -> Optional[str]:
        return validate_budget_category(v)


class BudgetUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, description="Updated budget amount")
    category: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Updated expense category or null",
    )
    year: Optional[int] = Field(default=None, ge=2000, le=2100)
    month: Optional[int] = Field(default=None, ge=1, le=12)

    @field_validator("amount", mode="after")
    @classmethod
    def check_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return validate_positive_amount(v)

    @field_validator("category", mode="after")
    @classmethod
    def check_category(cls, v: Optional[str]) -> Optional[str]:
        return validate_budget_category(v)


class BudgetResponse(BaseModel):
    id: int
    user_id: int
    year: int
    month: int
    category: Optional[str] = None
    amount: Decimal
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # Computed fields
    actual_spending: Decimal = Decimal("0.00")
    remaining: Decimal = Decimal("0.00")
    utilization_percentage: Decimal = Decimal("0.0")
    over_budget: bool = False

    model_config = ConfigDict(from_attributes=True)


class CategoryBudgetSummary(BaseModel):
    id: int
    category: str
    budget: Decimal
    spent: Decimal
    remaining: Decimal
    utilization: Decimal
    over_budget: bool

    model_config = ConfigDict(from_attributes=True)


class OverallBudgetSummary(BaseModel):
    id: int
    budget: Decimal
    spent: Decimal
    remaining: Decimal
    utilization: Decimal
    over_budget: bool

    model_config = ConfigDict(from_attributes=True)


class BudgetSummaryResponse(BaseModel):
    year: int
    month: int
    currency: str = "INR"

    # Overall budget fields (None if no overall budget configured)
    overall_budget: Optional[Decimal] = None
    overall_budget_id: Optional[int] = None
    overall_spending: Decimal = Decimal("0.00")
    overall_remaining: Optional[Decimal] = None
    overall_utilization: Optional[Decimal] = None
    overall_over_budget: bool = False

    # Nested overall summary object
    overall: Optional[OverallBudgetSummary] = None

    # Category budget summaries
    category_budgets: List[CategoryBudgetSummary] = []

    # Metadata
    has_overall_budget: bool = False
    total_categories_budgeted: int = 0
    has_any_budget: bool = False

    model_config = ConfigDict(from_attributes=True)
