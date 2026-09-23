from decimal import Decimal
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.financial_profile import FinancialProfile
from app.schemas.financial_profile import (
    FinancialProfileResponse,
    FinancialProfileUpdate,
    OnboardingCompleteRequest,
)

router = APIRouter()


@router.get("/financial", response_model=FinancialProfileResponse)
def get_financial_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Retrieve the financial profile for the currently authenticated student.
    Returns 404 if the student has not yet initialized a profile.
    """
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial profile not found",
        )
    return profile


@router.patch("/financial", response_model=FinancialProfileResponse)
def update_financial_profile(
    payload: FinancialProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create or update draft financial profile preferences for the currently authenticated student.
    Does not mark onboarding complete.
    """
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        profile = FinancialProfile(
            user_id=current_user.id,
            starting_balance=payload.starting_balance if payload.starting_balance is not None else Decimal("0.00"),
            money_sources=payload.money_sources if payload.money_sources is not None else [],
            financial_focus=payload.financial_focus if payload.financial_focus is not None else [],
            onboarding_completed=False,
        )
        db.add(profile)
    else:
        if payload.starting_balance is not None:
            profile.starting_balance = payload.starting_balance
        if payload.money_sources is not None:
            profile.money_sources = payload.money_sources
        if payload.financial_focus is not None:
            profile.financial_focus = payload.financial_focus

    db.commit()
    db.refresh(profile)
    return profile


@router.post("/onboarding/complete", response_model=FinancialProfileResponse)
def complete_onboarding(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    payload: Optional[OnboardingCompleteRequest] = None,
):
    """
    Mark student onboarding complete after validating that required fields
    (starting balance and at least one money source) are provided.
    """
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        profile = FinancialProfile(
            user_id=current_user.id,
            starting_balance=payload.starting_balance if payload and payload.starting_balance is not None else Decimal("0.00"),
            money_sources=payload.money_sources if payload and payload.money_sources is not None else [],
            financial_focus=payload.financial_focus if payload and payload.financial_focus is not None else [],
            onboarding_completed=False,
        )
        db.add(profile)
    else:
        if payload:
            if payload.starting_balance is not None:
                profile.starting_balance = payload.starting_balance
            if payload.money_sources is not None:
                profile.money_sources = payload.money_sources
            if payload.financial_focus is not None:
                profile.financial_focus = payload.financial_focus

    # Validation: starting_balance cannot be negative and money_sources must have at least 1 item
    if profile.starting_balance is None or profile.starting_balance < Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid non-negative starting balance is required",
        )

    if not profile.money_sources or len(profile.money_sources) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one money source must be selected to complete onboarding",
        )

    profile.onboarding_completed = True
    db.commit()
    db.refresh(profile)
    return profile
