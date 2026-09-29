from decimal import Decimal
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.account import (
    ConnectedAccountResponse,
    ConnectedAccountListResponse,
    SyncRunResponse,
    AccountDisconnectResponse,
)
from app.services.bank_sync_service import BankSyncService

router = APIRouter()


@router.get("", response_model=ConnectedAccountListResponse)
def list_accounts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List all connected financial accounts belonging exclusively to the authenticated student.
    Returns account cards, active balances, and aggregate connected funds.
    """
    accounts = BankSyncService.get_user_accounts(db, current_user)
    total_balance = sum(
        (acc.current_balance for acc in accounts if acc.current_balance is not None and acc.status == "ACTIVE"),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))

    return ConnectedAccountListResponse(
        items=accounts,
        total_connected_balance=total_balance,
        total_accounts=len(accounts),
    )


@router.post("/connect/mock", response_model=ConnectedAccountResponse, status_code=status.HTTP_201_CREATED)
def connect_mock_account(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Connect a sandbox demo bank account for testing automated sync and Account Aggregator flows.
    Guarantees no real bank credentials or PINs are collected.
    """
    return BankSyncService.connect_mock_account(db, current_user)


@router.get("/{account_id}", response_model=ConnectedAccountResponse)
def get_account_detail(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get details of a single connected account.
    Returns 404 if the account does not exist or belongs to another user.
    """
    account = BankSyncService.get_account(db, current_user, account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connected financial account not found",
        )
    return account


@router.post("/{account_id}/sync", response_model=SyncRunResponse)
def sync_account(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Trigger automated synchronization of bank balance and transactions for this account.
    Idempotent: importing the same feed multiple times will not duplicate transactions.
    """
    return BankSyncService.sync_account(db, current_user, account_id)


@router.post("/{account_id}/disconnect", response_model=AccountDisconnectResponse)
def disconnect_account(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Disconnect a connected account and revoke associated Account Aggregator consent.
    Preserves ledger integrity by keeping previously imported transactions.
    """
    updated_account = BankSyncService.disconnect_account(db, current_user, account_id)
    return AccountDisconnectResponse(
        success=True,
        message="Account disconnected successfully and consent revoked",
        account=updated_account,
    )


@router.get("/{account_id}/sync-history", response_model=List[SyncRunResponse])
def get_sync_history(
    account_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=50),
):
    """
    Fetch the sync audit history for a connected account.
    Returns 404 if the account belongs to another student.
    """
    return BankSyncService.get_sync_history(db, current_user, account_id, limit=limit)
