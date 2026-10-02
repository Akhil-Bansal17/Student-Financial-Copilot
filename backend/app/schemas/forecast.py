from decimal import Decimal
import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class ForecastEventResponse(BaseModel):
    id: str
    date: datetime.date
    type: str  # EXPECTED_INCOME, RECURRING_EXPENSE, RECURRING_SUBSCRIPTION, RECURRING_BILL, ESTIMATED_SPENDING, GOAL_ALLOCATION, OTHER
    name: str
    amount: Decimal
    is_inflow: bool
    category: Optional[str] = None
    source: str
    is_known_commitment: bool
    projected_balance_after: Decimal

    model_config = ConfigDict(from_attributes=True)


class ForecastDailyPointResponse(BaseModel):
    date: datetime.date
    projected_balance: Decimal
    is_actual: bool
    events_count: int
    daily_inflow: Decimal
    daily_outflow: Decimal
    is_below_minimum: bool
    is_negative: bool

    model_config = ConfigDict(from_attributes=True)


class ForecastGoalPlanning(BaseModel):
    goal_id: int
    goal_name: str
    target_amount: Decimal
    current_amount: Decimal
    remaining_amount: Decimal
    target_date: Optional[datetime.date] = None
    suggested_monthly_allocation: Optional[Decimal] = None
    is_affordable: bool

    model_config = ConfigDict(from_attributes=True)


class ForecastBudgetPressure(BaseModel):
    budget_id: int
    category: str
    allocated_amount: Decimal
    spent_amount: Decimal
    projected_recurring_spend: Decimal
    projected_total_spend: Decimal
    utilization_percentage: Decimal
    projected_over_budget: bool

    model_config = ConfigDict(from_attributes=True)


class ForecastSummaryResponse(BaseModel):
    current_ledger_balance: Decimal
    current_connected_bank_balance: Optional[Decimal] = None
    starting_balance: Decimal
    projected_balance: Decimal
    net_cash_flow: Decimal
    forecast_days: int
    expected_income: Decimal
    expected_recurring_expenses: Decimal
    estimated_discretionary_spending: Decimal
    projected_total_outflow: Decimal
    minimum_projected_balance: Decimal
    minimum_balance_date: Optional[datetime.date] = None
    is_negative_projected: bool
    negative_balance_date: Optional[datetime.date] = None
    is_low_balance_projected: bool
    low_balance_date: Optional[datetime.date] = None
    minimum_balance_threshold: Decimal
    data_sufficiency: str  # INSUFFICIENT, LIMITED, MODERATE, STRONG
    confidence: str        # LOW, MEDIUM, HIGH
    bank_data_freshness: Optional[str] = None
    bank_last_synced_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CashFlowForecastResponse(BaseModel):
    current_ledger_balance: Decimal
    current_connected_bank_balance: Optional[Decimal] = None
    starting_balance: Decimal
    projected_balance: Decimal
    net_cash_flow: Decimal
    forecast_days: int
    expected_income: Decimal
    expected_recurring_expenses: Decimal
    estimated_discretionary_spending: Decimal
    projected_total_outflow: Decimal
    minimum_projected_balance: Decimal
    minimum_balance_date: Optional[datetime.date] = None
    is_negative_projected: bool
    negative_balance_date: Optional[datetime.date] = None
    is_low_balance_projected: bool
    low_balance_date: Optional[datetime.date] = None
    minimum_balance_threshold: Decimal
    data_sufficiency: str
    confidence: str
    bank_data_freshness: Optional[str] = None
    bank_last_synced_at: Optional[datetime.datetime] = None
    timeline: List[ForecastEventResponse]
    daily_points: List[ForecastDailyPointResponse]
    goal_planning: List[ForecastGoalPlanning]
    budget_pressure: List[ForecastBudgetPressure]
    contributing_factors: List[str]
    warnings: List[str]

    model_config = ConfigDict(from_attributes=True)


class ForecastTimelineResponse(BaseModel):
    forecast_days: int
    timeline: List[ForecastEventResponse]

    model_config = ConfigDict(from_attributes=True)


class ForecastPreferenceUpdate(BaseModel):
    minimum_balance_threshold: Optional[Decimal] = Field(None, ge=0)
    is_enabled: Optional[bool] = None


class ForecastPreferenceResponse(BaseModel):
    id: int
    user_id: int
    minimum_balance_threshold: Decimal
    is_enabled: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
