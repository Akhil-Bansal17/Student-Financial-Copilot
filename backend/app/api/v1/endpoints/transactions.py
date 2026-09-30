from decimal import Decimal
import datetime
from typing import Annotated, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction
from app.core.constants import EXPENSE_CATEGORIES, INCOME_CATEGORIES
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionListResponse,
    FinancialSummaryResponse,
    BulkCategoryUpdatePayload,
    BulkCategoryUpdateResponse,
)
from app.services.transaction_service import TransactionService

router = APIRouter()


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create an income or expense transaction for the authenticated student.
    Extracts and normalizes merchant if present.
    """
    return TransactionService.create_transaction(db, current_user, payload)


@router.get("/summary", response_model=FinancialSummaryResponse)
def get_financial_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Calculate real monetary totals for the authenticated student:
    - starting_balance from financial profile (defaults to 0.00 if uncompleted/missing)
    - total_income (sum of income transactions)
    - total_expenses (sum of expense transactions)
    - current_balance = starting_balance + total_income - total_expenses
    """
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == current_user.id)
        .first()
    )
    starting_balance = Decimal(profile.starting_balance) if profile else Decimal("0.00")

    # Aggregate income
    total_income = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "income",
        )
        .scalar()
    )
    total_income = Decimal(total_income).quantize(Decimal("0.01"))

    # Aggregate expenses
    total_expenses = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "expense",
        )
        .scalar()
    )
    total_expenses = Decimal(total_expenses).quantize(Decimal("0.01"))

    # Current balance calculation
    current_balance = (starting_balance + total_income - total_expenses).quantize(Decimal("0.01"))

    return FinancialSummaryResponse(
        starting_balance=starting_balance.quantize(Decimal("0.01")),
        total_income=total_income,
        total_expenses=total_expenses,
        current_balance=current_balance,
        currency="INR",
    )


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    transaction_type: Optional[Literal["income", "expense"]] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    merchant: Optional[str] = None,
    source: Optional[str] = None,
    account_id: Optional[int] = None,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    min_amount: Optional[Decimal] = None,
    max_amount: Optional[Decimal] = None,
    reconciliation_status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    List transactions belonging exclusively to the authenticated student,
    with server-side filtering, merchant search, date/amount range, and pagination.
    """
    items, total = TransactionService.list_transactions(
        db=db,
        user=current_user,
        transaction_type=transaction_type,
        category=category,
        search=search,
        merchant=merchant,
        source=source,
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        min_amount=min_amount,
        max_amount=max_amount,
        reconciliation_status=reconciliation_status,
        limit=limit,
        offset=offset,
    )

    return TransactionListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/bulk-category", response_model=BulkCategoryUpdateResponse)
def bulk_update_category(
    payload: BulkCategoryUpdatePayload,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Safely bulk update categories across multiple transactions owned by the user.
    Optionally persists merchant preference for all updated merchants.
    """
    return TransactionService.bulk_update_category(db, current_user, payload)


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction_detail(
    transaction_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get a single transaction. Strictly returns 404 if the record does not exist
    or belongs to another user.
    """
    return TransactionService.get_transaction_detail(db, current_user, transaction_id)


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Edit a transaction belonging to the authenticated student.
    Enforces bank provenance safeguards and optionally saves merchant preference.
    """
    return TransactionService.update_transaction(db, current_user, transaction_id, payload)


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a transaction belonging to the authenticated student.
    Strictly returns 404 if the record does not exist or belongs to another user.
    """
    TransactionService.delete_transaction(db, current_user, transaction_id)
    return {"success": True, "message": "Transaction deleted successfully"}
