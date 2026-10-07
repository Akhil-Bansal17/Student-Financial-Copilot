import datetime
from enum import Enum
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class NotificationPriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class NotificationType(str, Enum):
    # Forecast
    FORECAST_NEGATIVE_BALANCE = "FORECAST_NEGATIVE_BALANCE"
    FORECAST_LOW_BUFFER = "FORECAST_LOW_BUFFER"

    # Budget
    BUDGET_APPROACHING_LIMIT = "BUDGET_APPROACHING_LIMIT"
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"

    # Goals
    GOAL_AT_RISK = "GOAL_AT_RISK"
    GOAL_NEEDS_ATTENTION = "GOAL_NEEDS_ATTENTION"
    GOAL_MILESTONE = "GOAL_MILESTONE"
    GOAL_COMPLETED = "GOAL_COMPLETED"

    # Recurring Expenses
    RECURRING_PAYMENT_UPCOMING = "RECURRING_PAYMENT_UPCOMING"
    RECURRING_PAYMENT_MISSED = "RECURRING_PAYMENT_MISSED"
    RECURRING_PRICE_CHANGE = "RECURRING_PRICE_CHANGE"

    # Spending Patterns
    SPENDING_HIGH_GROWTH = "SPENDING_HIGH_GROWTH"
    SPENDING_CONCENTRATION = "SPENDING_CONCENTRATION"
    SPENDING_LARGE_TRANSACTION = "SPENDING_LARGE_TRANSACTION"

    # Bank Connections
    BANK_SYNC_STALE = "BANK_SYNC_STALE"
    BANK_SYNC_FAILED = "BANK_SYNC_FAILED"

    # Financial Health
    FINANCIAL_HEALTH_CRITICAL = "FINANCIAL_HEALTH_CRITICAL"
    FINANCIAL_HEALTH_HIGH_PRIORITY = "FINANCIAL_HEALTH_HIGH_PRIORITY"

    # Positive Highlights
    POSITIVE_SAVINGS_MILESTONE = "POSITIVE_SAVINGS_MILESTONE"
    POSITIVE_BUDGET_PROGRESS = "POSITIVE_BUDGET_PROGRESS"
    POSITIVE_FORECAST = "POSITIVE_FORECAST"


class NotificationCategory(str, Enum):
    FORECAST = "FORECAST"
    BUDGET = "BUDGET"
    GOALS = "GOALS"
    RECURRING = "RECURRING"
    BANK = "BANK"
    SPENDING = "SPENDING"
    FINANCIAL_HEALTH = "FINANCIAL_HEALTH"
    POSITIVE = "POSITIVE"


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    notification_type: str
    priority: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    action_url: Optional[str] = None
    dedupe_key: str
    is_read: bool
    read_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    expires_at: Optional[datetime.datetime] = None
    metadata_json: Optional[Any] = None


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total_count: int
    unread_count: int
    page: int
    page_size: int
    total_pages: int


class UnreadCountResponse(BaseModel):
    unread_count: int
    critical_count: int
    high_count: int


class NotificationPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    smart_alerts_enabled: bool = True
    forecast_alerts_enabled: bool = True
    budget_alerts_enabled: bool = True
    goal_alerts_enabled: bool = True
    recurring_alerts_enabled: bool = True
    bank_alerts_enabled: bool = True
    spending_alerts_enabled: bool = True
    positive_alerts_enabled: bool = True
    updated_at: datetime.datetime


class NotificationPreferenceUpdate(BaseModel):
    smart_alerts_enabled: Optional[bool] = None
    forecast_alerts_enabled: Optional[bool] = None
    budget_alerts_enabled: Optional[bool] = None
    goal_alerts_enabled: Optional[bool] = None
    recurring_alerts_enabled: Optional[bool] = None
    bank_alerts_enabled: Optional[bool] = None
    spending_alerts_enabled: Optional[bool] = None
    positive_alerts_enabled: Optional[bool] = None


class AlertEvaluationResult(BaseModel):
    evaluated_count: int
    created_count: int
    skipped_dedupe_count: int
    suppressed_count: int
    created_notifications: List[NotificationResponse] = Field(default_factory=list)
