from decimal import Decimal
import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

GoalStatus = Literal["active", "completed", "overdue"]


def validate_positive_amount(v: Optional[Decimal]) -> Optional[Decimal]:
    if v is None:
        return v
    if v.is_nan() or v.is_infinite():
        raise ValueError("Amount must be a finite number")
    if v <= Decimal("0"):
        raise ValueError("Amount must be greater than zero")
    return v.quantize(Decimal("0.01"))


class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Goal title / name")
    description: Optional[str] = Field(default=None, max_length=255, description="Optional description")
    target_amount: Decimal = Field(..., description="Target savings amount (must be positive)")
    target_date: Optional[datetime.date] = Field(default=None, description="Target completion date (YYYY-MM-DD)")

    @field_validator("name", mode="after")
    @classmethod
    def check_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Goal name cannot be empty or whitespace")
        return cleaned

    @field_validator("description", mode="after")
    @classmethod
    def check_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None

    @field_validator("target_amount", mode="after")
    @classmethod
    def check_amount(cls, v: Decimal) -> Decimal:
        val = validate_positive_amount(v)
        assert val is not None
        return val


class GoalUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    target_amount: Optional[Decimal] = Field(default=None)
    target_date: Optional[datetime.date] = Field(default=None)

    @field_validator("name", mode="after")
    @classmethod
    def check_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Goal name cannot be empty or whitespace")
        return cleaned

    @field_validator("description", mode="after")
    @classmethod
    def check_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None

    @field_validator("target_amount", mode="after")
    @classmethod
    def check_amount(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return validate_positive_amount(v)


class GoalContributionCreate(BaseModel):
    amount: Decimal = Field(..., description="Contribution amount (must be positive)")
    note: Optional[str] = Field(default=None, max_length=255, description="Optional note")

    @field_validator("amount", mode="after")
    @classmethod
    def check_amount(cls, v: Decimal) -> Decimal:
        val = validate_positive_amount(v)
        assert val is not None
        return val

    @field_validator("note", mode="after")
    @classmethod
    def check_note(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None


class GoalContributionResponse(BaseModel):
    id: int
    goal_id: int
    user_id: int
    amount: Decimal
    note: Optional[str] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class GoalResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    target_amount: Decimal
    current_amount: Decimal
    target_date: Optional[datetime.date] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # Computed fields
    remaining_amount: Decimal
    progress_percentage: Decimal
    status: GoalStatus
    contributions: List[GoalContributionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class GoalsOverviewResponse(BaseModel):
    total_goals_count: int = 0
    active_goals_count: int = 0
    completed_goals_count: int = 0
    overdue_goals_count: int = 0
    total_target_amount: Decimal = Decimal("0.00")
    total_saved_amount: Decimal = Decimal("0.00")
    overall_progress_percentage: Decimal = Decimal("0.0")
    goals: List[GoalResponse] = []

    model_config = ConfigDict(from_attributes=True)
