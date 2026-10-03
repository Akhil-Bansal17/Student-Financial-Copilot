from decimal import Decimal
import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class CashBufferStatus(str, Enum):
    HEALTHY_BUFFER = "HEALTHY_BUFFER"
    LIMITED_BUFFER = "LIMITED_BUFFER"
    LOW_BUFFER = "LOW_BUFFER"
    AT_RISK = "AT_RISK"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class CashFlowStabilityStatus(str, Enum):
    STABLE = "STABLE"
    MODERATELY_VARIABLE = "MODERATELY_VARIABLE"
    HIGHLY_VARIABLE = "HIGHLY_VARIABLE"
    NEGATIVE_TREND = "NEGATIVE_TREND"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class BudgetHealthStatus(str, Enum):
    ON_TRACK = "ON_TRACK"
    APPROACHING_LIMIT = "APPROACHING_LIMIT"
    OVER_BUDGET = "OVER_BUDGET"
    NO_ACTIVE_BUDGET = "NO_ACTIVE_BUDGET"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class RecurringBurdenStatus(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class GoalHealthStatus(str, Enum):
    ON_TRACK = "ON_TRACK"
    NEEDS_ATTENTION = "NEEDS_ATTENTION"
    AT_RISK = "AT_RISK"
    COMPLETED = "COMPLETED"
    NO_ACTIVE_GOALS = "NO_ACTIVE_GOALS"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class SpendingPatternStatus(str, Enum):
    HEALTHY_PATTERN = "HEALTHY_PATTERN"
    MODERATE_PATTERN = "MODERATE_PATTERN"
    ELEVATED_SPENDING = "ELEVATED_SPENDING"
    HIGH_CONCENTRATION = "HIGH_CONCENTRATION"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class ForecastRiskStatus(str, Enum):
    LOW_RISK = "LOW_RISK"
    MODERATE_RISK = "MODERATE_RISK"
    HIGH_RISK = "HIGH_RISK"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class ActionPriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class ActionType(str, Enum):
    FORECAST_NEGATIVE = "FORECAST_NEGATIVE"
    FORECAST_LOW_BUFFER = "FORECAST_LOW_BUFFER"
    BUDGET_OVERRUN = "BUDGET_OVERRUN"
    BUDGET_WARNING = "BUDGET_WARNING"
    GOAL_PACE = "GOAL_PACE"
    GOAL_OVERDUE = "GOAL_OVERDUE"
    SUBSCRIPTION_INCREASE = "SUBSCRIPTION_INCREASE"
    RECURRING_MISSED = "RECURRING_MISSED"
    RECURRING_BURDEN_HIGH = "RECURRING_BURDEN_HIGH"
    BANK_SYNC_STALE = "BANK_SYNC_STALE"
    SPENDING_SPIKE = "SPENDING_SPIKE"
    NO_ACTIVE_BUDGET = "NO_ACTIVE_BUDGET"
    NO_ACTIVE_GOALS = "NO_ACTIVE_GOALS"
    DATA_COLLECTION = "DATA_COLLECTION"


class HealthDimensionDetail(BaseModel):
    dimension: str = Field(..., description="Unique dimension identifier")
    name: str = Field(..., description="User-friendly name of the dimension")
    status: str = Field(..., description="Evaluated deterministic status enum")
    label: str = Field(..., description="Human-readable status label")
    summary: str = Field(..., description="Clear explanation of the evaluation")
    supporting_data: Dict[str, Any] = Field(default_factory=dict, description="Concrete supporting numbers and facts")
    is_positive: bool = Field(..., description="Whether this dimension represents a healthy state")
    is_attention_required: bool = Field(..., description="Whether this dimension requires immediate student attention")

    model_config = ConfigDict(from_attributes=True)


class SmartActionItem(BaseModel):
    id: str = Field(..., description="Deterministic unique action identifier for deduplication")
    type: ActionType = Field(..., description="Classification category of the action")
    title: str = Field(..., description="Concise headline for the action")
    description: str = Field(..., description="Clear factual explanation derived from verified records")
    priority: ActionPriority = Field(..., description="Deterministic priority level (CRITICAL, HIGH, MEDIUM, LOW, INFO)")
    reason: str = Field(..., description="Why this action is generated")
    supporting_metric: Optional[Dict[str, Any]] = Field(None, description="Concrete supporting numbers and thresholds")
    related_entity: Optional[Dict[str, Any]] = Field(None, description="Linked entity metadata (e.g. budget ID, goal ID, merchant)")
    recommended_next_step: str = Field(..., description="Actionable next step for the student")
    action_url: Optional[str] = Field(None, description="App navigation link to resolve or review the issue")
    generated_at: datetime.datetime = Field(..., description="Timestamp when the action was calculated")

    model_config = ConfigDict(from_attributes=True)


class PositiveSignalItem(BaseModel):
    id: str = Field(..., description="Deterministic unique identifier")
    dimension: str = Field(..., description="Associated financial health dimension")
    title: str = Field(..., description="Concise positive headline")
    description: str = Field(..., description="Factual description of what is going well")
    supporting_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Associated supporting numbers")

    model_config = ConfigDict(from_attributes=True)


class BankFreshnessDetail(BaseModel):
    connected_accounts_count: int = Field(..., description="Number of connected bank accounts")
    has_connected_bank: bool = Field(..., description="Whether user has connected accounts")
    last_synced_at: Optional[datetime.datetime] = Field(None, description="Most recent successful sync timestamp")
    is_stale: bool = Field(..., description="Whether bank data is older than the freshness threshold")
    sync_status: Optional[str] = Field(None, description="Current sync status (SUCCESS, FAILED, DELAYED, SYNCING)")
    freshness_description: str = Field(..., description="Human-readable freshness description")
    impacts_assessment: bool = Field(..., description="Whether stale bank data could affect calculation accuracy")

    model_config = ConfigDict(from_attributes=True)


class FinancialHealthOverview(BaseModel):
    data_sufficiency: str = Field(..., description="Data sufficiency level (INSUFFICIENT, LIMITED, MODERATE, STRONG)")
    overall_status_label: str = Field(..., description="Overall summary status phrase")
    overall_summary: str = Field(..., description="High-level narrative summary of current financial health")
    critical_actions_count: int = Field(..., description="Count of critical actions")
    high_actions_count: int = Field(..., description="Count of high priority actions")
    total_actions_count: int = Field(..., description="Total count of active actions")
    positive_signals_count: int = Field(..., description="Count of verified positive signals")
    primary_attention_dimension: Optional[str] = Field(None, description="Primary dimension needing student attention")

    model_config = ConfigDict(from_attributes=True)


class FinancialHealthResponse(BaseModel):
    overview: FinancialHealthOverview
    dimensions: Dict[str, HealthDimensionDetail]
    actions: List[SmartActionItem]
    positive_signals: List[PositiveSignalItem]
    bank_freshness: BankFreshnessDetail
    data_sufficiency: str
    generated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class SmartActionsResponse(BaseModel):
    actions: List[SmartActionItem]
    total_count: int
    by_priority: Dict[str, int]
    generated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
