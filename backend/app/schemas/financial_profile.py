from decimal import Decimal
import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

VALID_MONEY_SOURCES = {
    "Pocket Money",
    "Salary",
    "Freelance",
    "Scholarship",
    "Family Support",
    "Other",
}

VALID_FINANCIAL_FOCUS = {
    "Track my spending",
    "Save more money",
    "Control unnecessary spending",
    "Understand where my money goes",
    "Plan for a specific goal",
    "Just keep things organized",
}


def validate_balance(v: Optional[Decimal]) -> Optional[Decimal]:
    if v is None:
        return v
    if v.is_nan() or v.is_infinite():
        raise ValueError("Starting balance must be a finite number")
    if v < Decimal("0"):
        raise ValueError("Starting balance cannot be negative")
    return v.quantize(Decimal("0.01"))


def validate_sources(v: Optional[List[str]]) -> Optional[List[str]]:
    if v is None:
        return v
    for source in v:
        if source not in VALID_MONEY_SOURCES:
            raise ValueError(
                f"Invalid money source: '{source}'. Must be one of {sorted(VALID_MONEY_SOURCES)}"
            )
    return list(dict.fromkeys(v))


def validate_focus(v: Optional[List[str]]) -> Optional[List[str]]:
    if v is None:
        return v
    for focus in v:
        if focus not in VALID_FINANCIAL_FOCUS:
            raise ValueError(
                f"Invalid financial focus: '{focus}'. Must be one of {sorted(VALID_FINANCIAL_FOCUS)}"
            )
    return list(dict.fromkeys(v))


class FinancialProfileUpdate(BaseModel):
    starting_balance: Optional[Decimal] = None
    money_sources: Optional[List[str]] = None
    financial_focus: Optional[List[str]] = None

    @field_validator("starting_balance", mode="after")
    @classmethod
    def check_starting_balance(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return validate_balance(v)

    @field_validator("money_sources", mode="after")
    @classmethod
    def check_money_sources(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return validate_sources(v)

    @field_validator("financial_focus", mode="after")
    @classmethod
    def check_financial_focus(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return validate_focus(v)


class OnboardingCompleteRequest(BaseModel):
    starting_balance: Optional[Decimal] = None
    money_sources: Optional[List[str]] = None
    financial_focus: Optional[List[str]] = None

    @field_validator("starting_balance", mode="after")
    @classmethod
    def check_starting_balance(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return validate_balance(v)

    @field_validator("money_sources", mode="after")
    @classmethod
    def check_money_sources(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return validate_sources(v)

    @field_validator("financial_focus", mode="after")
    @classmethod
    def check_financial_focus(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return validate_focus(v)


class FinancialProfileResponse(BaseModel):
    id: int
    user_id: int
    starting_balance: Decimal
    onboarding_completed: bool
    money_sources: List[str]
    financial_focus: List[str]
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
