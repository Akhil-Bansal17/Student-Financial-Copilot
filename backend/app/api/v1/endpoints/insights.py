import datetime
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.insight import InsightsResponse
from app.services.insight_service import AdvancedInsightsService

router = APIRouter()


def resolve_year_month(year: Optional[int], month: Optional[int]) -> tuple[int, int]:
    now = datetime.datetime.now(datetime.timezone.utc)
    target_year = year if year is not None else now.year
    target_month = month if month is not None else now.month
    return target_year, target_month


@router.get("", response_model=InsightsResponse)
def get_insights(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(default=None, ge=1900, le=2200, description="Calendar year"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Calendar month (1-12)"),
):
    """
    Generate deterministic financial insights for the authenticated user:
    - Cash flow surplus/deficit
    - Top spending category and concentration
    - Month-over-month category spending trends and total changes
    - Approaching or exceeded budgets
    - Progress and milestones for savings goals
    - Conservative recurring expense patterns
    """
    target_year, target_month = resolve_year_month(year, month)
    return AdvancedInsightsService.generate_insights(
        db=db, user_id=current_user.id, year=target_year, month=target_month
    )
