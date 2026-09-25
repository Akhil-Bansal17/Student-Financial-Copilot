from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.goal import (
    GoalCreate,
    GoalUpdate,
    GoalResponse,
    GoalContributionCreate,
    GoalContributionResponse,
    GoalsOverviewResponse,
)
from app.services.goal_service import GoalService

router = APIRouter()


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new financial savings goal for the authenticated user."""
    return GoalService.create_goal(db=db, user_id=current_user.id, payload=payload)


@router.get("/overview", response_model=GoalsOverviewResponse)
def get_goals_overview(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get aggregated savings goals overview (counts, totals, progress)
    for dashboard and analytics summary.
    """
    return GoalService.get_overview(db=db, user_id=current_user.id)


@router.get("", response_model=List[GoalResponse])
def get_goals(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by status (active, completed, overdue)"),
):
    """List all financial goals for the authenticated user."""
    return GoalService.get_goals(db=db, user_id=current_user.id, status_filter=status_filter)


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(
    goal_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get an individual goal strictly belonging to the authenticated user."""
    return GoalService.get_goal_by_id(db=db, user_id=current_user.id, goal_id=goal_id)


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update goal name, description, target amount, or target date."""
    return GoalService.update_goal(db=db, user_id=current_user.id, goal_id=goal_id, payload=payload)


@router.delete("/{goal_id}")
def delete_goal(
    goal_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Delete a goal belonging to the authenticated user."""
    GoalService.delete_goal(db=db, user_id=current_user.id, goal_id=goal_id)
    return {"success": True, "message": "Goal deleted successfully"}


@router.post("/{goal_id}/contribute", response_model=GoalResponse)
def contribute_to_goal(
    goal_id: int,
    payload: GoalContributionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Add a savings contribution toward an active goal."""
    return GoalService.contribute(db=db, user_id=current_user.id, goal_id=goal_id, payload=payload)


@router.get("/{goal_id}/contributions", response_model=List[GoalContributionResponse])
def get_goal_contributions(
    goal_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """List contribution history for a goal."""
    return GoalService.get_contributions(db=db, user_id=current_user.id, goal_id=goal_id)


@router.delete("/{goal_id}/contributions/{contribution_id}", response_model=GoalResponse)
def delete_goal_contribution(
    goal_id: int,
    contribution_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Reverse / remove a specific savings contribution."""
    return GoalService.delete_contribution(
        db=db, user_id=current_user.id, goal_id=goal_id, contribution_id=contribution_id
    )
