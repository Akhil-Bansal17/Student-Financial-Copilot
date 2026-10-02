from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.recurring_preference import RecurringPreference
from app.schemas.recurring import (
    RecurringExpenseResponse,
    RecurringExpenseUpdate,
    RecurringExpenseDetailResponse,
    RecurringSummaryResponse,
    RecurringPreferenceCreate,
    RecurringPreferenceResponse,
)
from app.schemas.transaction import TransactionResponse
from app.services.recurring_expense_service import RecurringExpenseService

router = APIRouter(prefix="/recurring", tags=["Recurring Expenses & Subscriptions"])


@router.get("", response_model=List[RecurringExpenseResponse])
def get_recurring_expenses(
    status_filter: Optional[str] = Query(None, alias="status"),
    recurring_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    frequency: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List user's recurring expenses and subscriptions with optional filters.
    Enforces user isolation.
    """
    # Ensure detection has run at least once for user
    items = RecurringExpenseService.get_recurring_expenses(
        db=db,
        user_id=current_user.id,
        status=status_filter,
        recurring_type=recurring_type,
        category=category,
        frequency=frequency,
    )
    if not items and not status_filter and not recurring_type:
        # First-time run detection
        items = RecurringExpenseService.detect_and_sync_recurring(db, current_user.id)
    return items


@router.get("/summary", response_model=RecurringSummaryResponse)
def get_recurring_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get authoritative financial summary of recurring expenses, subscriptions,
    upcoming payments, price changes, and monthly spend estimates.
    """
    summary = RecurringExpenseService.get_recurring_summary(db, current_user.id)
    return summary


@router.post("/detect", response_model=List[RecurringExpenseResponse])
def detect_recurring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicitly trigger fresh deterministic recurring pattern detection across
    user's historical transactions.
    """
    return RecurringExpenseService.detect_and_sync_recurring(db, current_user.id)


@router.get("/preferences", response_model=List[RecurringPreferenceResponse])
def get_recurring_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get user's recurring preferences and overrides.
    """
    prefs = RecurringExpenseService.get_user_preferences(db, current_user.id)
    return list(prefs.values())


@router.post("/preferences", response_model=RecurringPreferenceResponse)
def set_recurring_preference(
    payload: RecurringPreferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Set a user recurring preference override (e.g. IGNORE, RECURRING, SUBSCRIPTION, BILL).
    """
    pref = RecurringExpenseService.set_user_preference(
        db=db,
        user_id=current_user.id,
        normalized_merchant=payload.normalized_merchant,
        preference_type=payload.preference_type,
    )
    return pref


@router.delete("/preferences/{merchant}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_preference(
    merchant: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a user recurring preference override.
    """
    deleted = RecurringExpenseService.delete_user_preference(
        db=db, user_id=current_user.id, normalized_merchant=merchant
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preference for merchant '{merchant}' not found",
        )
    return None


@router.get("/{recurring_id}", response_model=RecurringExpenseDetailResponse)
def get_recurring_expense_detail(
    recurring_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get single recurring expense details with transaction history and user preference.
    Guaranteed IDOR protection.
    """
    rec = RecurringExpenseService.get_recurring_expense_by_id(db, current_user.id, recurring_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found",
        )

    # Fetch past transactions
    history_txs = RecurringExpenseService.get_merchant_transaction_history(
        db=db,
        user_id=current_user.id,
        normalized_merchant=rec.normalized_merchant,
    )

    # Fetch user preference if exists
    prefs = RecurringExpenseService.get_user_preferences(db, current_user.id)
    pref = prefs.get(rec.normalized_merchant)

    return RecurringExpenseDetailResponse(
        recurring=RecurringExpenseResponse.model_validate(rec),
        history=[TransactionResponse.model_validate(t) for t in history_txs],
        user_preference=RecurringPreferenceResponse.model_validate(pref) if pref else None,
    )


@router.patch("/{recurring_id}", response_model=RecurringExpenseResponse)
def update_recurring_expense(
    recurring_id: int,
    payload: RecurringExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update recurring expense status, type, frequency, category, or notes.
    Guaranteed IDOR protection.
    """
    rec = RecurringExpenseService.update_recurring_expense(
        db=db,
        user_id=current_user.id,
        recurring_id=recurring_id,
        status=payload.status,
        recurring_type=payload.recurring_type,
        frequency=payload.frequency,
        category=payload.category,
        notes=payload.notes,
    )
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found",
        )
    return rec


@router.post("/{recurring_id}/ignore", response_model=RecurringExpenseResponse)
def ignore_recurring_expense(
    recurring_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicitly mark merchant as NOT recurring (IGNORE).
    Sets preference and updates status to USER_IGNORED.
    """
    rec = RecurringExpenseService.get_recurring_expense_by_id(db, current_user.id, recurring_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found",
        )
    RecurringExpenseService.set_user_preference(
        db=db,
        user_id=current_user.id,
        normalized_merchant=rec.normalized_merchant,
        preference_type="IGNORE",
    )
    rec = RecurringExpenseService.get_recurring_expense_by_id(db, current_user.id, recurring_id)
    return rec


@router.post("/{recurring_id}/confirm", response_model=RecurringExpenseResponse)
def confirm_recurring_expense(
    recurring_id: int,
    mark_as_subscription: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm recurring expense or un-ignore, optionally marking as subscription.
    """
    rec = RecurringExpenseService.get_recurring_expense_by_id(db, current_user.id, recurring_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found",
        )
    pref_type = "SUBSCRIPTION" if mark_as_subscription else "RECURRING"
    RecurringExpenseService.set_user_preference(
        db=db,
        user_id=current_user.id,
        normalized_merchant=rec.normalized_merchant,
        preference_type=pref_type,
    )
    # Ensure status is active
    rec = RecurringExpenseService.update_recurring_expense(
        db=db,
        user_id=current_user.id,
        recurring_id=recurring_id,
        status="ACTIVE",
        recurring_type="SUBSCRIPTION" if mark_as_subscription else rec.recurring_type,
    )
    return rec
