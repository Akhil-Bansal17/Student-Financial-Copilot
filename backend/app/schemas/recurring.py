from decimal import Decimal
import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.transaction import TransactionResponse


class RecurringPreferenceCreate(BaseModel):
    normalized_merchant: str = Field(..., min_length=1, max_length=100)
    preference_type: Literal["IGNORE", "RECURRING", "SUBSCRIPTION", "BILL"]


class RecurringPreferenceResponse(BaseModel):
    id: int
    user_id: int
    normalized_merchant: str
    preference_type: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class RecurringExpenseResponse(BaseModel):
    id: int
    user_id: int
    merchant: str
    normalized_merchant: str
    category: str
    recurring_type: str
    frequency: str
    is_variable_amount: bool
    confidence: str
    status: str
    average_amount: Decimal
    latest_amount: Decimal
    previous_amount: Optional[Decimal] = None
    min_amount: Decimal
    max_amount: Decimal
    amount_change: Optional[Decimal] = None
    amount_change_percentage: Optional[Decimal] = None
    occurrence_count: int
    last_occurrence_date: datetime.datetime
    next_expected_date: datetime.datetime
    notes: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class RecurringExpenseUpdate(BaseModel):
    status: Optional[Literal["ACTIVE", "PAUSED", "USER_IGNORED", "OVERDUE_EXPECTED", "POSSIBLY_ENDED"]] = None
    recurring_type: Optional[Literal["SUBSCRIPTION", "RECURRING_BILL", "RECURRING_EXPENSE", "RECURRING_OTHER"]] = None
    frequency: Optional[Literal["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]] = None
    category: Optional[str] = None
    notes: Optional[str] = None


class RecurringExpenseDetailResponse(BaseModel):
    recurring: RecurringExpenseResponse
    history: List[TransactionResponse]
    user_preference: Optional[RecurringPreferenceResponse] = None


class RecurringSummaryResponse(BaseModel):
    total_monthly_recurring_spend: Decimal
    subscription_count: int
    recurring_expense_count: int
    fixed_recurring_spend: Decimal
    variable_recurring_spend: Decimal
    subscription_monthly_spend: Decimal
    bill_monthly_spend: Decimal
    other_monthly_spend: Decimal
    upcoming_payments: List[RecurringExpenseResponse]
    recently_changed: List[RecurringExpenseResponse]
    needs_attention: List[RecurringExpenseResponse]
    total_detected_count: int
