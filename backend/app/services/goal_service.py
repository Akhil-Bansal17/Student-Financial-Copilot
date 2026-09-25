import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.goal import Goal, GoalContribution
from app.schemas.goal import (
    GoalCreate,
    GoalUpdate,
    GoalResponse,
    GoalStatus,
    GoalContributionCreate,
    GoalContributionResponse,
    GoalsOverviewResponse,
)


class GoalService:
    @staticmethod
    def calculate_metrics(
        target_amount: Decimal,
        current_amount: Decimal,
        target_date: Optional[datetime.date],
    ) -> Tuple[Decimal, Decimal, GoalStatus]:
        """
        Calculate remaining amount, progress percentage, and deterministic goal status.
        - remaining_amount = target_amount - current_amount
        - progress_percentage = (current_amount / target_amount) * 100
        - status:
          * completed: if current_amount >= target_amount (even if target_date is in the past)
          * overdue: if not completed AND target_date is in the past (< today in UTC)
          * active: otherwise
        """
        remaining = (target_amount - current_amount).quantize(Decimal("0.01"))
        if remaining < Decimal("0.00"):
            remaining = Decimal("0.00")

        if target_amount > Decimal("0"):
            progress = ((current_amount / target_amount) * Decimal("100")).quantize(Decimal("0.1"))
            if progress > Decimal("100.0"):
                progress = Decimal("100.0")
        else:
            progress = Decimal("0.0")

        today = datetime.datetime.now(datetime.timezone.utc).date()

        if current_amount >= target_amount:
            goal_status: GoalStatus = "completed"
        elif target_date is not None and target_date < today:
            goal_status = "overdue"
        else:
            goal_status = "active"

        return remaining, progress, goal_status

    @classmethod
    def to_goal_response(cls, goal: Goal) -> GoalResponse:
        """
        Convert a Goal ORM object into a GoalResponse enriched with calculated metrics.
        """
        remaining, progress, goal_status = cls.calculate_metrics(
            goal.target_amount, goal.current_amount, goal.target_date
        )

        contribution_responses = [
            GoalContributionResponse(
                id=c.id,
                goal_id=c.goal_id,
                user_id=c.user_id,
                amount=c.amount,
                note=c.note,
                created_at=c.created_at,
            )
            for c in goal.contributions
        ]

        return GoalResponse(
            id=goal.id,
            user_id=goal.user_id,
            name=goal.name,
            description=goal.description,
            target_amount=goal.target_amount,
            current_amount=goal.current_amount,
            target_date=goal.target_date,
            created_at=goal.created_at,
            updated_at=goal.updated_at,
            remaining_amount=remaining,
            progress_percentage=progress,
            status=goal_status,
            contributions=contribution_responses,
        )

    @classmethod
    def create_goal(cls, db: Session, user_id: int, payload: GoalCreate) -> GoalResponse:
        """Create a new savings goal for the authenticated student."""
        goal = Goal(
            user_id=user_id,
            name=payload.name,
            description=payload.description,
            target_amount=payload.target_amount,
            current_amount=Decimal("0.00"),
            target_date=payload.target_date,
        )
        db.add(goal)
        db.commit()
        db.refresh(goal)
        return cls.to_goal_response(goal)

    @classmethod
    def get_goals(
        cls,
        db: Session,
        user_id: int,
        status_filter: Optional[str] = None,
    ) -> List[GoalResponse]:
        """List all goals for the authenticated student, optionally filtered by status."""
        goals = (
            db.query(Goal)
            .filter(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
            .all()
        )
        responses = [cls.to_goal_response(g) for g in goals]
        if status_filter:
            responses = [r for r in responses if r.status == status_filter]
        return responses

    @classmethod
    def get_goal_by_id(cls, db: Session, user_id: int, goal_id: int) -> GoalResponse:
        """Get an individual goal strictly belonging to the authenticated student."""
        goal = (
            db.query(Goal)
            .filter(Goal.id == goal_id, Goal.user_id == user_id)
            .first()
        )
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )
        return cls.to_goal_response(goal)

    @classmethod
    def update_goal(
        cls,
        db: Session,
        user_id: int,
        goal_id: int,
        payload: GoalUpdate,
    ) -> GoalResponse:
        """
        Update goal title, description, target amount, or target date.
        Cannot reduce target amount below currently saved amount.
        """
        goal = (
            db.query(Goal)
            .filter(Goal.id == goal_id, Goal.user_id == user_id)
            .first()
        )
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        if payload.target_amount is not None:
            if payload.target_amount < goal.current_amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Target amount (₹{payload.target_amount}) cannot be less than currently saved amount (₹{goal.current_amount})",
                )
            goal.target_amount = payload.target_amount

        if payload.name is not None:
            goal.name = payload.name

        if payload.description is not None:
            goal.description = payload.description

        if payload.target_date is not None:
            goal.target_date = payload.target_date

        db.commit()
        db.refresh(goal)
        return cls.to_goal_response(goal)

    @classmethod
    def delete_goal(cls, db: Session, user_id: int, goal_id: int) -> None:
        """
        Delete a goal belonging strictly to the authenticated student.
        Never modifies account balance or transaction records.
        """
        goal = (
            db.query(Goal)
            .filter(Goal.id == goal_id, Goal.user_id == user_id)
            .first()
        )
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )
        db.delete(goal)
        db.commit()

    @classmethod
    def contribute(
        cls,
        db: Session,
        user_id: int,
        goal_id: int,
        payload: GoalContributionCreate,
    ) -> GoalResponse:
        """
        Add savings contribution toward a goal:
        - Validates goal ownership
        - Prevents overfunding beyond remaining target
        - Atomically increments goal.current_amount
        - Records history entry in goal_contributions
        """
        goal = (
            db.query(Goal)
            .filter(Goal.id == goal_id, Goal.user_id == user_id)
            .first()
        )
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        remaining = goal.target_amount - goal.current_amount
        if remaining <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This goal is already fully funded",
            )

        if payload.amount > remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Contribution of ₹{payload.amount} exceeds remaining target of ₹{remaining}",
            )

        contribution = GoalContribution(
            goal_id=goal.id,
            user_id=user_id,
            amount=payload.amount,
            note=payload.note,
        )
        db.add(contribution)

        goal.current_amount = (goal.current_amount + payload.amount).quantize(Decimal("0.01"))
        db.commit()
        db.refresh(goal)
        return cls.to_goal_response(goal)

    @classmethod
    def get_contributions(
        cls,
        db: Session,
        user_id: int,
        goal_id: int,
    ) -> List[GoalContributionResponse]:
        """List contribution history for a specific goal."""
        # Verify goal ownership first
        goal = (
            db.query(Goal)
            .filter(Goal.id == goal_id, Goal.user_id == user_id)
            .first()
        )
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        contributions = (
            db.query(GoalContribution)
            .filter(GoalContribution.goal_id == goal_id, GoalContribution.user_id == user_id)
            .order_by(GoalContribution.created_at.desc())
            .all()
        )
        return [
            GoalContributionResponse(
                id=c.id,
                goal_id=c.goal_id,
                user_id=c.user_id,
                amount=c.amount,
                note=c.note,
                created_at=c.created_at,
            )
            for c in contributions
        ]

    @classmethod
    def delete_contribution(
        cls,
        db: Session,
        user_id: int,
        goal_id: int,
        contribution_id: int,
    ) -> GoalResponse:
        """
        Reverse / remove a specific contribution:
        - Atomically subtracts contribution amount from goal.current_amount
        - Deletes contribution record
        """
        goal = (
            db.query(Goal)
            .filter(Goal.id == goal_id, Goal.user_id == user_id)
            .first()
        )
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        contribution = (
            db.query(GoalContribution)
            .filter(
                GoalContribution.id == contribution_id,
                GoalContribution.goal_id == goal_id,
                GoalContribution.user_id == user_id,
            )
            .first()
        )
        if not contribution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contribution not found",
            )

        new_current = goal.current_amount - contribution.amount
        if new_current < Decimal("0.00"):
            new_current = Decimal("0.00")
        goal.current_amount = new_current.quantize(Decimal("0.01"))

        db.delete(contribution)
        db.commit()
        db.refresh(goal)
        return cls.to_goal_response(goal)

    @classmethod
    def get_overview(cls, db: Session, user_id: int) -> GoalsOverviewResponse:
        """
        Generate overview metrics across all student savings goals:
        total counts, active, completed, overdue, total target and saved amounts.
        """
        goals = (
            db.query(Goal)
            .filter(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
            .all()
        )
        responses = [cls.to_goal_response(g) for g in goals]

        total_target = sum((r.target_amount for r in responses), Decimal("0.00")).quantize(Decimal("0.01"))
        total_saved = sum((r.current_amount for r in responses), Decimal("0.00")).quantize(Decimal("0.01"))

        if total_target > Decimal("0.00"):
            overall_progress = ((total_saved / total_target) * Decimal("100")).quantize(Decimal("0.1"))
            if overall_progress > Decimal("100.0"):
                overall_progress = Decimal("100.0")
        else:
            overall_progress = Decimal("0.0")

        return GoalsOverviewResponse(
            total_goals_count=len(responses),
            active_goals_count=sum(1 for r in responses if r.status == "active"),
            completed_goals_count=sum(1 for r in responses if r.status == "completed"),
            overdue_goals_count=sum(1 for r in responses if r.status == "overdue"),
            total_target_amount=total_target,
            total_saved_amount=total_saved,
            overall_progress_percentage=overall_progress,
            goals=responses,
        )
