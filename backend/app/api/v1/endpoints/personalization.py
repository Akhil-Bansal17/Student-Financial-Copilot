from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.personalization import (
    PersonalizationProfileResponse,
    PersonalizationProfileUpdate,
    BehavioralSignalsResponse,
    EffectivePersonalizationConfig,
)
from app.services.personalization_service import PersonalizationService
from app.services.behavioral_signal_service import BehavioralSignalService

router = APIRouter(prefix="/personalization", tags=["Smart Financial Personalization & Adaptive Intelligence"])


@router.get("", response_model=PersonalizationProfileResponse, status_code=status.HTTP_200_OK)
def get_personalization_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonalizationProfileResponse:
    """
    Retrieve the personalization profile for the authenticated student.
    Lazily creates default preferences if this is the student's first access.
    Guarantees strict user tenant isolation (IDOR resistant).
    """
    profile = PersonalizationService.get_or_create_profile(db, current_user.id)
    return PersonalizationProfileResponse.model_validate(profile)


@router.patch("", response_model=PersonalizationProfileResponse, status_code=status.HTTP_200_OK)
def update_personalization_profile(
    updates: PersonalizationProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonalizationProfileResponse:
    """
    Update personalization settings (sensitivity, financial priority, recurring reminder timing, thresholds).
    Enforces user validation and deterministic boundaries.
    """
    updated_profile = PersonalizationService.update_profile(db, current_user.id, updates)
    return PersonalizationProfileResponse.model_validate(updated_profile)


@router.post("/reset", response_model=PersonalizationProfileResponse, status_code=status.HTTP_200_OK)
def reset_personalization_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonalizationProfileResponse:
    """
    Reset the authenticated student's personalization profile back to default values.
    Leaves all transactions, budgets, goals, recurring commitments, and bank connections completely intact.
    """
    reset_prof = PersonalizationService.reset_profile(db, current_user.id)
    return PersonalizationProfileResponse.model_validate(reset_prof)


@router.get("/signals", response_model=BehavioralSignalsResponse, status_code=status.HTTP_200_OK)
def get_behavioral_signals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BehavioralSignalsResponse:
    """
    Compute deterministic behavioral signals (frequent merchants, categories, typical spend, timing).
    Never invents facts; explicitly discloses evidence sufficiency tier.
    """
    return BehavioralSignalService.calculate_behavioral_signals(db, current_user.id)


@router.get("/effective", response_model=EffectivePersonalizationConfig, status_code=status.HTTP_200_OK)
def get_effective_personalization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EffectivePersonalizationConfig:
    """
    Retrieve unified effective personalization configuration, combining authoritative thresholds
    from ForecastPreference with user preferences and personalized Smart Action rankings.
    """
    return PersonalizationService.get_effective_preferences(db, current_user.id)
