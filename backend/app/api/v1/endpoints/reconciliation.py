import datetime
from decimal import Decimal
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.account import ConnectedAccount
from app.models.transaction import Transaction
from app.models.financial_profile import FinancialProfile
from app.models.reconciliation import TransactionReconciliation
from app.services.reconciliation_service import TransactionReconciliationService
from app.schemas.reconciliation import (
    ReconciliationItemResponse,
    ReconciliationSummaryResponse,
    SyncStatusResponse,
)

router = APIRouter()


@router.get("/pending", response_model=List[ReconciliationItemResponse])
def get_pending_reconciliations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Retrieve all possible duplicate transactions awaiting user reconciliation review.
    """
    records = (
        db.query(TransactionReconciliation)
        .filter(
            TransactionReconciliation.user_id == current_user.id,
            TransactionReconciliation.status == "PENDING_REVIEW",
        )
        .order_by(TransactionReconciliation.created_at.desc())
        .all()
    )
    return records


@router.get("/summary", response_model=ReconciliationSummaryResponse)
def get_reconciliation_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Summary counts of pending reviews and reconciled transactions for badges and alert banners.
    """
    pending_count = (
        db.query(func.count(TransactionReconciliation.id))
        .filter(
            TransactionReconciliation.user_id == current_user.id,
            TransactionReconciliation.status == "PENDING_REVIEW",
        )
        .scalar()
        or 0
    )
    reconciled_count = (
        db.query(func.count(TransactionReconciliation.id))
        .filter(
            TransactionReconciliation.user_id == current_user.id,
            TransactionReconciliation.status.in_(("AUTO_RECONCILED", "MATCHED")),
        )
        .scalar()
        or 0
    )
    return ReconciliationSummaryResponse(
        pending_count=pending_count,
        reconciled_count=reconciled_count,
    )


@router.post("/{reconciliation_id}/match", response_model=ReconciliationItemResponse)
def match_reconciliation(
    reconciliation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    User action [Match]:
    Confirms that the manual transaction and bank transaction are the same financial event.
    Enriches manual transaction with bank provenance and marks reconciled without duplicating the ledger.
    """
    record = TransactionReconciliationService.resolve_user_match(
        db=db,
        user=current_user,
        reconciliation_id=reconciliation_id,
    )
    return record


@router.post("/{reconciliation_id}/keep-separate")
def keep_separate_reconciliation(
    reconciliation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    User action [Keep Separate]:
    Confirms that the manual and bank transactions are distinct financial events.
    Imports the bank transaction into the ledger as a genuine new transaction.
    """
    new_tx = TransactionReconciliationService.resolve_keep_separate(
        db=db,
        user=current_user,
        reconciliation_id=reconciliation_id,
    )
    return {
        "status": "SEPARATE",
        "message": "Transactions kept separate. Bank transaction added to ledger.",
        "transaction_id": new_tx.id,
    }


@router.get("/status", response_model=SyncStatusResponse)
def get_sync_freshness_status(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Calculate real-time bank synchronization freshness, bank balance vs ledger balance,
    and pending reconciliation review counts for Dashboard and Connected Accounts.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    accounts = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == current_user.id,
            ConnectedAccount.status == "ACTIVE",
        )
        .all()
    )

    total_connected = len(accounts)
    total_bank_balance = Decimal("0.00")
    latest_sync: Optional[datetime.datetime] = None
    has_syncing = False
    has_failed = False

    for acc in accounts:
        if acc.current_balance is not None:
            total_bank_balance += acc.current_balance
        if acc.last_synced_at is not None:
            sync_dt = acc.last_synced_at if acc.last_synced_at.tzinfo else acc.last_synced_at.replace(tzinfo=datetime.timezone.utc)
            if latest_sync is None or sync_dt > latest_sync:
                latest_sync = sync_dt
        if acc.sync_lock_at is not None:
            lock_age = (now - acc.sync_lock_at).total_seconds()
            if lock_age < 300:
                has_syncing = True
        if acc.last_sync_status == "FAILED":
            has_failed = True

    # Compute current ledger balance
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == current_user.id)
        .first()
    )
    starting_balance = Decimal(profile.starting_balance) if profile and profile.starting_balance else Decimal("0.00")

    total_income = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "income",
        )
        .scalar()
        or Decimal("0.00")
    )
    total_expenses = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0.00")))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "expense",
        )
        .scalar()
        or Decimal("0.00")
    )
    ledger_balance = (starting_balance + Decimal(total_income) - Decimal(total_expenses)).quantize(Decimal("0.01"))
    total_bank_balance = total_bank_balance.quantize(Decimal("0.01"))
    difference = (total_bank_balance - ledger_balance).quantize(Decimal("0.01"))

    # Staleness check: > 12 hours without sync or no sync yet
    is_stale = False
    if total_connected == 0:
        sync_status = "NO_ACCOUNTS"
    elif has_syncing:
        sync_status = "SYNCING"
    elif has_failed:
        sync_status = "FAILED"
    elif latest_sync is None:
        sync_status = "DELAYED"
        is_stale = True
    else:
        hours_old = (now - latest_sync).total_seconds() / 3600
        if hours_old > 12:
            sync_status = "DELAYED"
            is_stale = True
        else:
            sync_status = "UP_TO_DATE"

    pending_count = (
        db.query(func.count(TransactionReconciliation.id))
        .filter(
            TransactionReconciliation.user_id == current_user.id,
            TransactionReconciliation.status == "PENDING_REVIEW",
        )
        .scalar()
        or 0
    )

    return SyncStatusResponse(
        last_synced_at=latest_sync,
        sync_status=sync_status,
        is_stale=is_stale,
        total_connected_accounts=total_connected,
        total_bank_balance=total_bank_balance,
        ledger_balance=ledger_balance,
        balance_difference=difference,
        pending_reconciliations=pending_count,
    )
