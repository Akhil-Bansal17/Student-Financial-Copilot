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
)

router = APIRouter()


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create an income or expense transaction for the authenticated student.
    """
    tx_date = payload.transaction_date or datetime.datetime.now(datetime.timezone.utc)
    # Ensure timezone awareness if naive
    if tx_date.tzinfo is None:
        tx_date = tx_date.replace(tzinfo=datetime.timezone.utc)

    transaction = Transaction(
        user_id=current_user.id,
        transaction_type=payload.transaction_type,
        amount=payload.amount,
        category=payload.category,
        description=payload.description.strip() if payload.description else None,
        payment_method=payload.payment_method,
        transaction_date=tx_date,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


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
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    List transactions belonging exclusively to the authenticated student,
    with support for pagination and filtering by type, category, or date range.
    """
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    if category:
        query = query.filter(Transaction.category == category)
    if start_date:
        start_dt = datetime.datetime.combine(start_date, datetime.time.min, tzinfo=datetime.timezone.utc)
        query = query.filter(Transaction.transaction_date >= start_dt)
    if end_date:
        end_dt = datetime.datetime.combine(end_date, datetime.time.max, tzinfo=datetime.timezone.utc)
        query = query.filter(Transaction.transaction_date <= end_dt)

    total = query.count()
    items = (
        query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return TransactionListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


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
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return tx


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Edit a transaction belonging to the authenticated student.
    """
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    effective_type = payload.transaction_type or tx.transaction_type
    effective_category = payload.category or tx.category

    # Verify type / category consistency
    if effective_type == "income" and effective_category not in INCOME_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Category '{effective_category}' is not valid for income transactions",
        )
    if effective_type == "expense" and effective_category not in EXPENSE_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Category '{effective_category}' is not valid for expense transactions",
        )

    if payload.transaction_type is not None:
        tx.transaction_type = payload.transaction_type
    if payload.amount is not None:
        tx.amount = payload.amount
    if payload.category is not None:
        tx.category = payload.category
    if payload.description is not None:
        tx.description = payload.description.strip() if payload.description else None
    if payload.payment_method is not None:
        tx.payment_method = payload.payment_method
    if payload.transaction_date is not None:
        dt = payload.transaction_date
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        tx.transaction_date = dt

    db.commit()
    db.refresh(tx)
    return tx


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
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    db.delete(tx)
    db.commit()
    return {"success": True, "message": "Transaction deleted successfully"}
