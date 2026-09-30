from typing import Annotated, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.merchant_preference import (
    MerchantPreferenceCreate,
    MerchantPreferenceUpdate,
    MerchantPreferenceResponse,
)
from app.services.merchant_preference_service import MerchantPreferenceService

router = APIRouter()


@router.get("", response_model=List[MerchantPreferenceResponse])
def list_merchant_preferences(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List all deterministic merchant-to-category preferences for the authenticated student.
    """
    return MerchantPreferenceService.list_preferences(db, current_user)


@router.post("", response_model=MerchantPreferenceResponse, status_code=status.HTTP_201_CREATED)
def create_or_set_merchant_preference(
    payload: MerchantPreferenceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Save or update a persistent merchant-to-category preference.
    """
    return MerchantPreferenceService.set_preference(
        db=db,
        user=current_user,
        normalized_merchant=payload.normalized_merchant,
        category=payload.category,
    )


@router.put("/{preference_id}", response_model=MerchantPreferenceResponse)
def update_merchant_preference(
    preference_id: int,
    payload: MerchantPreferenceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update the category for an existing merchant preference.
    Enforces user isolation and ownership.
    """
    return MerchantPreferenceService.update_preference(
        db=db,
        user=current_user,
        preference_id=preference_id,
        category=payload.category,
    )


@router.delete("/{preference_id}")
def delete_merchant_preference(
    preference_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a merchant preference.
    Enforces user isolation and ownership.
    """
    MerchantPreferenceService.delete_preference(db, current_user, preference_id)
    return {"success": True, "message": "Merchant preference deleted"}
