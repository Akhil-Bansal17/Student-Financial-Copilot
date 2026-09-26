from enum import Enum
from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field


class InsightType(str, Enum):
    CASH_FLOW = "cash_flow"
    TOP_CATEGORY = "top_category"
    SPENDING_TREND = "spending_trend"
    MONTHLY_CHANGE = "monthly_change"
    SPENDING_CONCENTRATION = "spending_concentration"
    BUDGET = "budget"
    GOAL = "goal"
    RECURRING_PATTERN = "recurring_pattern"


class InsightPriority(str, Enum):
    POSITIVE = "positive"
    WARNING = "warning"
    INFO = "info"


class FinancialInsight(BaseModel):
    id: str = Field(..., description="Deterministic unique identifier for the insight")
    type: InsightType = Field(..., description="Classification category of the insight")
    priority: InsightPriority = Field(..., description="Visual and priority level (positive, warning, info)")
    category: Optional[str] = Field(None, description="Associated expense or income category, if applicable")
    title: str = Field(..., description="Concise headline for the insight card")
    description: str = Field(..., description="Clear factual explanation derived from real user data")
    amount: Optional[Decimal] = Field(None, description="Relevant monetary amount in INR, if applicable")
    percentage: Optional[Decimal] = Field(None, description="Relevant percentage value (e.g. 18.4), if applicable")
    period: str = Field(..., description="Month period represented as YYYY-MM")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional deterministic attributes for UI or Copilot consumption")


class InsightsSummaryMetrics(BaseModel):
    total_insights_count: int
    positive_count: int
    warning_count: int
    info_count: int
    has_sufficient_data: bool


class InsightsResponse(BaseModel):
    year: int
    month: int
    period: str
    has_sufficient_data: bool
    summary: InsightsSummaryMetrics
    insights: List[FinancialInsight]
