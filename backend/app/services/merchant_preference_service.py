from typing import List, Optional
import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.merchant_preference import MerchantCategoryPreference
from app.core.constants import ALL_CATEGORIES


class MerchantPreferenceService:
    """
    Manages persistent merchant-to-category preferences for authenticated users.
    Strictly isolated by user_id to ensure complete data privacy and tenancy security.
    """

    @staticmethod
    def list_preferences(db: Session, user: User) -> List[MerchantCategoryPreference]:
        """List all merchant category preferences for the authenticated student."""
        return (
            db.query(MerchantCategoryPreference)
            .filter(MerchantCategoryPreference.user_id == user.id)
            .order_by(MerchantCategoryPreference.normalized_merchant.asc())
            .all()
        )

    @staticmethod
    def get_preference(db: Session, user: User, preference_id: int) -> MerchantCategoryPreference:
        """Get a single preference with strict ownership check."""
        pref = (
            db.query(MerchantCategoryPreference)
            .filter(
                MerchantCategoryPreference.id == preference_id,
                MerchantCategoryPreference.user_id == user.id,
            )
            .first()
        )
        if not pref:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merchant category preference not found",
            )
        return pref

    @staticmethod
    def set_preference(
        db: Session,
        user: User,
        normalized_merchant: str,
        category: str,
    ) -> MerchantCategoryPreference:
        """
        Create or update a merchant category preference for the authenticated student.
        Normalizes the merchant key and validates that the category is legitimate.
        """
        norm_key = normalized_merchant.upper().strip()
        if not norm_key:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Merchant name cannot be empty",
            )

        if category not in ALL_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Category '{category}' is invalid. Must be one of {sorted(ALL_CATEGORIES)}",
            )

        existing = (
            db.query(MerchantCategoryPreference)
            .filter(
                MerchantCategoryPreference.user_id == user.id,
                MerchantCategoryPreference.normalized_merchant == norm_key,
            )
            .first()
        )

        now = datetime.datetime.now(datetime.timezone.utc)
        if existing:
            existing.category = category
            existing.updated_at = now
            db.commit()
            db.refresh(existing)
            return existing

        pref = MerchantCategoryPreference(
            user_id=user.id,
            normalized_merchant=norm_key,
            category=category,
            created_at=now,
            updated_at=now,
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)
        return pref

    @staticmethod
    def update_preference(
        db: Session,
        user: User,
        preference_id: int,
        category: str,
    ) -> MerchantCategoryPreference:
        """Update an existing preference's category with ownership verification."""
        pref = MerchantPreferenceService.get_preference(db, user, preference_id)

        if category not in ALL_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Category '{category}' is invalid. Must be one of {sorted(ALL_CATEGORIES)}",
            )

        pref.category = category
        pref.updated_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(pref)
        return pref

    @staticmethod
    def delete_preference(db: Session, user: User, preference_id: int) -> bool:
        """Delete a merchant preference with ownership verification."""
        pref = MerchantPreferenceService.get_preference(db, user, preference_id)
        db.delete(pref)
        db.commit()
        return True
