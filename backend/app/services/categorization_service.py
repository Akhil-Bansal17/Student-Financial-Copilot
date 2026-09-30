from dataclasses import dataclass
from typing import Optional, Dict
from sqlalchemy.orm import Session

from app.core.constants import (
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    ALL_CATEGORIES,
)
from app.models.merchant_preference import MerchantCategoryPreference


@dataclass
class CategorizationResult:
    category: str
    confidence: str  # "HIGH", "MEDIUM", "LOW"
    source: str      # "USER_MANUAL", "USER_PREFERENCE", "RULE_HIGH", "RULE_SUGGESTION", "PROVIDER", "DEFAULT"
    suggested_category: Optional[str] = None


class CategorizationService:
    """
    Deterministic rule-based categorization engine.
    Enforces strict hierarchy:
    1. User manual selection (USER_MANUAL) - inviolable.
    2. User-specific merchant preference (USER_PREFERENCE).
    3. High-confidence global merchant rules (RULE_HIGH).
    4. Medium/Low-confidence suggestions (RULE_SUGGESTION).
    5. Provider-supplied category (PROVIDER).
    6. Fallback (DEFAULT -> 'Other').
    """

    # High-confidence global merchant mappings
    GLOBAL_HIGH_CONFIDENCE_EXPENSES: Dict[str, str] = {
        "SWIGGY": "Food",
        "ZOMATO": "Food",
        "MCDONALDS": "Food",
        "DOMINOS": "Food",
        "KFC": "Food",
        "SUBWAY": "Food",
        "STARBUCKS": "Food",
        "CAMPUS CANTEEN": "Food",
        "COLLEGE CAFE": "Food",
        "HOSTEL MESS": "Food",
        "UBER": "Transport",
        "OLA": "Transport",
        "RAPIDO": "Transport",
        "METRO RAIL": "Transport",
        "CITY BUS": "Transport",
        "UNIVERSITY BOOKSTORE": "Education",
        "CAMPUS STORE": "Education",
        "NETFLIX": "Entertainment",
        "SPOTIFY": "Entertainment",
        "BOOKMYSHOW": "Entertainment",
        "AIRTEL": "Bills",
        "JIO": "Bills",
        "VODAFONE IDEA": "Bills",
        "HOSTEL BROADBAND": "Bills",
    }

    # Medium-confidence global merchant mappings (suggestions)
    GLOBAL_MEDIUM_CONFIDENCE_EXPENSES: Dict[str, str] = {
        "AMAZON": "Shopping",
        "FLIPKART": "Shopping",
        "ZEPTO": "Food",
        "BLINKIT": "Food",
        "BIGBASKET": "Food",
    }

    # High-confidence income mappings
    GLOBAL_HIGH_CONFIDENCE_INCOME: Dict[str, str] = {
        "GOVT SCHOLARSHIP CELL": "Scholarship",
        "MINISTRY OF EDUCATION": "Scholarship",
        "TECH CLIENT": "Freelance",
    }

    @classmethod
    def categorize(
        cls,
        db: Session,
        user_id: int,
        transaction_type: str,
        normalized_merchant: Optional[str] = None,
        raw_description: Optional[str] = None,
        provider_category: Optional[str] = None,
        existing_category: Optional[str] = None,
        existing_source: Optional[str] = None,
    ) -> CategorizationResult:
        """
        Determines the authoritative category according to the strict priority hierarchy.
        """
        # Level 1: If transaction already has a user-selected category, preserve it!
        if existing_source == "USER_MANUAL" and existing_category:
            valid = (
                existing_category in INCOME_CATEGORIES
                if transaction_type == "income"
                else existing_category in EXPENSE_CATEGORIES
            )
            if valid:
                return CategorizationResult(
                    category=existing_category,
                    confidence="HIGH",
                    source="USER_MANUAL",
                )

        # Level 2: User-specific merchant preference
        if normalized_merchant:
            user_pref = (
                db.query(MerchantCategoryPreference)
                .filter(
                    MerchantCategoryPreference.user_id == user_id,
                    MerchantCategoryPreference.normalized_merchant == normalized_merchant.upper().strip(),
                )
                .first()
            )
            if user_pref:
                valid = (
                    user_pref.category in INCOME_CATEGORIES
                    if transaction_type == "income"
                    else user_pref.category in EXPENSE_CATEGORIES
                )
                if valid:
                    return CategorizationResult(
                        category=user_pref.category,
                        confidence="HIGH",
                        source="USER_PREFERENCE",
                    )

        merchant_key = normalized_merchant.upper().strip() if normalized_merchant else None

        # Level 3: High-confidence global merchant rules
        if merchant_key:
            if transaction_type == "income":
                if merchant_key in cls.GLOBAL_HIGH_CONFIDENCE_INCOME:
                    return CategorizationResult(
                        category=cls.GLOBAL_HIGH_CONFIDENCE_INCOME[merchant_key],
                        confidence="HIGH",
                        source="RULE_HIGH",
                    )
            else:
                if merchant_key in cls.GLOBAL_HIGH_CONFIDENCE_EXPENSES:
                    return CategorizationResult(
                        category=cls.GLOBAL_HIGH_CONFIDENCE_EXPENSES[merchant_key],
                        confidence="HIGH",
                        source="RULE_HIGH",
                    )

        # Level 4: Medium-confidence global merchant suggestions
        if merchant_key and transaction_type == "expense" and merchant_key in cls.GLOBAL_MEDIUM_CONFIDENCE_EXPENSES:
            suggested = cls.GLOBAL_MEDIUM_CONFIDENCE_EXPENSES[merchant_key]
            # If provider category is available and valid, we use provider category; otherwise use suggested
            if provider_category and provider_category in EXPENSE_CATEGORIES:
                return CategorizationResult(
                    category=provider_category,
                    confidence="MEDIUM",
                    source="PROVIDER",
                    suggested_category=suggested,
                )
            return CategorizationResult(
                category=suggested,
                confidence="MEDIUM",
                source="RULE_SUGGESTION",
                suggested_category=suggested,
            )

        # Level 5: Provider-supplied category if trustworthy and valid
        if provider_category:
            valid = (
                provider_category in INCOME_CATEGORIES
                if transaction_type == "income"
                else provider_category in EXPENSE_CATEGORIES
            )
            if valid:
                return CategorizationResult(
                    category=provider_category,
                    confidence="MEDIUM",
                    source="PROVIDER",
                )

        # Level 6: Default fallback
        fallback = "Other"
        return CategorizationResult(
            category=fallback,
            confidence="LOW",
            source="DEFAULT",
            suggested_category="Other",
        )
