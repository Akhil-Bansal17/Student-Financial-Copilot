import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class AlertSensitivity(str, Enum):
    CONSERVATIVE = "CONSERVATIVE"
    BALANCED = "BALANCED"
    RELAXED = "RELAXED"
    LOW = "LOW"
    HIGH = "HIGH"


class FinancialPriority(str, Enum):
    SAVE_MORE = "SAVE_MORE"
    CONTROL_SPENDING = "CONTROL_SPENDING"
    STAY_WITHIN_BUDGET = "STAY_WITHIN_BUDGET"
    BUILD_BUFFER = "BUILD_BUFFER"
    REACH_GOALS = "REACH_GOALS"
    UNDERSTAND_SPENDING = "UNDERSTAND_SPENDING"
    BALANCED = "BALANCED"


class DataSufficiencyLevel(str, Enum):
    INSUFFICIENT = "INSUFFICIENT"
    LIMITED = "LIMITED"
    MODERATE = "MODERATE"
    STRONG = "STRONG"


class FrequentMerchantSignal(BaseModel):
    merchant_name: str
    transaction_count: int
    total_spend: Decimal
    average_amount: Decimal
    category: str
    frequency_share_pct: float

    model_config = ConfigDict(from_attributes=True)


class FrequentCategorySignal(BaseModel):
    category: str
    total_spend: Decimal
    percentage: float
    transaction_count: int

    model_config = ConfigDict(from_attributes=True)


class SpendingTimingSignal(BaseModel):
    weekend_spend_percentage: float
    weekday_spend_percentage: float
    month_start_spend_percentage: float
    month_mid_spend_percentage: float
    month_end_spend_percentage: float
    timing_observation: str

    model_config = ConfigDict(from_attributes=True)


class BehavioralSignalsResponse(BaseModel):
    data_sufficiency: DataSufficiencyLevel
    transaction_count: int
    analyzed_period_months: int
    typical_transaction_amount: Decimal
    average_transaction_amount: Decimal
    calculated_large_threshold: Decimal
    frequent_merchants: List[FrequentMerchantSignal]
    frequent_categories: List[FrequentCategorySignal]
    spending_timing: SpendingTimingSignal
    signals_summary: str
    generated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class PersonalizationProfileResponse(BaseModel):
    id: int
    user_id: int
    is_personalization_enabled: bool = True
    alert_sensitivity: AlertSensitivity = AlertSensitivity.BALANCED
    financial_priority: FinancialPriority = FinancialPriority.BALANCED
    large_transaction_threshold: Optional[Decimal] = None
    recurring_alert_days_before: int = 3
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class PersonalizationProfileUpdate(BaseModel):
    is_personalization_enabled: Optional[bool] = None
    alert_sensitivity: Optional[AlertSensitivity] = None
    financial_priority: Optional[FinancialPriority] = None
    large_transaction_threshold: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    recurring_alert_days_before: Optional[int] = Field(None, ge=1, le=14)

    model_config = ConfigDict(from_attributes=True)


class EffectivePersonalizationConfig(BaseModel):
    is_personalization_enabled: bool
    alert_sensitivity: AlertSensitivity
    financial_priority: FinancialPriority
    effective_large_transaction_threshold: Decimal
    is_custom_large_threshold: bool
    recurring_alert_days_before: int
    minimum_balance_threshold: Decimal
    minimum_balance_source: str = "ForecastPreference"
    data_sufficiency: DataSufficiencyLevel
    priority_focus_description: str
    top_recommended_action: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
