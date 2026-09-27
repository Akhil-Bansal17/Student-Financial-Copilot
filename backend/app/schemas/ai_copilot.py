from typing import List, Optional, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$", description="Role of the sender")
    content: str = Field(..., min_length=1, max_length=2000, description="Text message content")


class CopilotChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="User question or inquiry for the Financial Copilot",
    )
    year: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2200,
        description="Selected calendar year (defaults to current year)",
    )
    month: Optional[int] = Field(
        default=None,
        ge=1,
        le=12,
        description="Selected calendar month (1-12, defaults to current month)",
    )
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        max_length=10,
        description="Optional recent conversation turns for conversational context",
    )
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=None,
        max_length=10,
        description="Optional recent conversation turns for conversational context",
    )

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message cannot be empty or whitespace only.")
        return v.strip()


class FinancialContextSummary(BaseModel):
    period: str
    current_balance: Optional[Decimal] = None
    monthly_income: Optional[Decimal] = None
    monthly_expenses: Optional[Decimal] = None
    monthly_net_cash_flow: Optional[Decimal] = None
    top_spending_category: Optional[str] = None
    active_goals_count: int = 0
    has_sufficient_data: bool = False


class CopilotChatResponse(BaseModel):
    answer: str = Field(..., description="Deterministic, grounded explanation from the AI Financial Copilot")
    period: str = Field(..., description="Target financial period (YYYY-MM)")
    has_sufficient_data: bool = Field(..., description="Whether sufficient verified ledger records exist")
    context_used: Dict[str, Any] = Field(
        default_factory=dict,
        description="Summary of verified financial markers utilized in generating the response",
    )
    context_summary: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Summary of verified financial markers utilized in generating the response",
    )
