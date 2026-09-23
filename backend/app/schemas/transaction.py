from decimal import Decimal
import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

from app.core.constants import (
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    ALL_CATEGORIES,
    PAYMENT_METHODS,
)


def validate_positive_amount(v: Optional[Decimal]) -> Optional[Decimal]:
    if v is None:
        return v
    if v.is_nan() or v.is_infinite():
        raise ValueError("Amount must be a finite number")
    if v <= Decimal("0"):
        raise ValueError("Amount must be greater than zero")
    return v.quantize(Decimal("0.01"))


class TransactionCreate(BaseModel):
    transaction_type: Literal["income", "expense"]
    amount: Decimal = Field(..., description="Transaction amount (must be positive)")
    category: str = Field(..., max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)
    payment_method: str = Field(..., max_length=50)
    transaction_date: Optional[datetime.datetime] = None

    @field_validator("amount", mode="after")
    @classmethod
    def check_amount(cls, v: Decimal) -> Decimal:
        val = validate_positive_amount(v)
        assert val is not None
        return val

    @field_validator("payment_method", mode="after")
    @classmethod
    def check_payment_method(cls, v: str) -> str:
        if v not in PAYMENT_METHODS:
            raise ValueError(
                f"Invalid payment method: '{v}'. Must be one of {sorted(PAYMENT_METHODS)}"
            )
        return v

    @model_validator(mode="after")
    def validate_category_for_type(self) -> "TransactionCreate":
        if self.transaction_type == "income":
            if self.category not in INCOME_CATEGORIES:
                raise ValueError(
                    f"Invalid income category: '{self.category}'. Must be one of {sorted(INCOME_CATEGORIES)}"
                )
        elif self.transaction_type == "expense":
            if self.category not in EXPENSE_CATEGORIES:
                raise ValueError(
                    f"Invalid expense category: '{self.category}'. Must be one of {sorted(EXPENSE_CATEGORIES)}"
                )
        return self


class TransactionUpdate(BaseModel):
    transaction_type: Optional[Literal["income", "expense"]] = None
    amount: Optional[Decimal] = None
    category: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)
    payment_method: Optional[str] = Field(default=None, max_length=50)
    transaction_date: Optional[datetime.datetime] = None

    @field_validator("amount", mode="after")
    @classmethod
    def check_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return validate_positive_amount(v)

    @field_validator("payment_method", mode="after")
    @classmethod
    def check_payment_method(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in PAYMENT_METHODS:
            raise ValueError(
                f"Invalid payment method: '{v}'. Must be one of {sorted(PAYMENT_METHODS)}"
            )
        return v

    @model_validator(mode="after")
    def validate_category(self) -> "TransactionUpdate":
        if self.category is not None:
            if self.transaction_type == "income":
                if self.category not in INCOME_CATEGORIES:
                    raise ValueError(
                        f"Invalid income category: '{self.category}'. Must be one of {sorted(INCOME_CATEGORIES)}"
                    )
            elif self.transaction_type == "expense":
                if self.category not in EXPENSE_CATEGORIES:
                    raise ValueError(
                        f"Invalid expense category: '{self.category}'. Must be one of {sorted(EXPENSE_CATEGORIES)}"
                    )
            else:
                if self.category not in ALL_CATEGORIES:
                    raise ValueError(
                        f"Invalid category: '{self.category}'. Must be one of {sorted(ALL_CATEGORIES)}"
                    )
        return self


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    transaction_type: str
    amount: Decimal
    category: str
    description: Optional[str] = None
    payment_method: str
    transaction_date: datetime.datetime
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionListResponse(BaseModel):
    items: List[TransactionResponse]
    total: int
    limit: int
    offset: int


class FinancialSummaryResponse(BaseModel):
    starting_balance: Decimal
    total_income: Decimal
    total_expenses: Decimal
    current_balance: Decimal
    currency: str = "INR"
