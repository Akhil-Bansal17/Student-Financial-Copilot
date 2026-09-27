import asyncio
import datetime
import logging
from typing import Optional, List
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.ai_copilot import ChatMessage, CopilotChatResponse
from app.services.financial_context_builder import FinancialContextBuilder
from app.services.ai_provider import get_ai_provider, MockAIProvider, SYSTEM_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)


class AICopilotService:
    """
    Central orchestration service for the AI Financial Copilot.
    Strictly derives all financial data from authenticated user context.
    """

    @classmethod
    async def chat(
        cls,
        db: Session,
        user: User,
        message: str,
        year: Optional[int] = None,
        month: Optional[int] = None,
        history: Optional[List[ChatMessage]] = None,
    ) -> CopilotChatResponse:
        now = datetime.datetime.now(datetime.timezone.utc)
        target_year = year if year is not None else now.year
        target_month = month if month is not None else now.month
        period_str = f"{target_year:04d}-{target_month:02d}"

        # 1. Build Authoritative Deterministic Financial Context for current user ONLY
        financial_context = FinancialContextBuilder.build_context(
            db=db,
            user_id=user.id,
            year=target_year,
            month=target_month,
        )

        # 2. Sanitize and bound conversation history
        sanitized_history = []
        if history:
            bounded_history = history[-settings.AI_MAX_HISTORY_MESSAGES:]
            for msg in bounded_history:
                sanitized_history.append({"role": msg.role, "content": msg.content[:1500]})

        # 3. Get AI Provider
        provider = get_ai_provider()

        # 4. Generate AI response with timeout & failure resilience
        try:
            answer = await asyncio.wait_for(
                provider.generate_response(
                    system_instruction=SYSTEM_PROMPT_TEMPLATE,
                    user_prompt=message.strip(),
                    conversation_history=sanitized_history,
                    financial_context=financial_context,
                ),
                timeout=settings.AI_REQUEST_TIMEOUT_SECONDS,
            )
        except (asyncio.TimeoutError, Exception) as exc:
            logger.warning(
                "AI Provider failed or timed out (%s). Falling back to deterministic copilot engine.",
                str(exc),
            )
            # Resilient fallback: use deterministic MockAIProvider so user receives a reliable answer
            fallback_provider = MockAIProvider()
            answer = await fallback_provider.generate_response(
                system_instruction=SYSTEM_PROMPT_TEMPLATE,
                user_prompt=message.strip(),
                conversation_history=sanitized_history,
                financial_context=financial_context,
            )

        # 5. Extract lightweight context summary
        acc = financial_context.get("account_summary", {})
        monthly = financial_context.get("monthly_analytics", {})
        top_cats = financial_context.get("top_expense_categories", [])
        top_cat_name = top_cats[0]["category"] if top_cats else None
        goal_ov = financial_context.get("goal_overview", {})

        context_used = {
            "period": period_str,
            "current_balance": acc.get("current_balance"),
            "monthly_income": monthly.get("income"),
            "monthly_expenses": monthly.get("expenses"),
            "monthly_net_cash_flow": monthly.get("net_cash_flow"),
            "top_spending_category": top_cat_name,
            "active_goals_count": goal_ov.get("active_goals_count", 0),
            "has_sufficient_data": financial_context.get("has_sufficient_data", False),
        }

        return CopilotChatResponse(
            answer=answer,
            period=period_str,
            has_sufficient_data=financial_context.get("has_sufficient_data", False),
            context_used=context_used,
            context_summary=context_used,
        )
