from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai_copilot import CopilotChatRequest, CopilotChatResponse
from app.services.ai_copilot_service import AICopilotService

router = APIRouter()


@router.post(
    "/copilot",
    response_model=CopilotChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Query the AI Financial Copilot with natural language",
)
async def chat_with_copilot(
    request: CopilotChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CopilotChatResponse:
    """
    Interact with the student's personal AI Financial Copilot.
    Strictly isolated to the authenticated user's verified financial context.
    Never fabricates transactions, budgets, or balances.
    """
    history_messages = request.conversation_history or request.history
    return await AICopilotService.chat(
        db=db,
        user=current_user,
        message=request.message,
        year=request.year,
        month=request.month,
        history=history_messages,
    )
