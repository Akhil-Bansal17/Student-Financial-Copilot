import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.account import ConnectedAccount, AccountConsent, SyncRun
from app.models.transaction import Transaction
from app.core.constants import EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS
from app.services.bank_provider.base import BankProviderError
from app.services.bank_provider.factory import get_bank_provider


class BankSyncService:
    """
    Coordinates account linking, consent lifecycle, bank data fetching,
    transaction normalization, duplicate prevention, and sync audit logging.
    """

    @staticmethod
    def connect_mock_account(db: Session, user: User) -> ConnectedAccount:
        """
        Connect or reconnect a sandbox mock bank account for the authenticated user.
        Generates realistic student demo account and consent metadata.
        """
        provider = get_bank_provider("mock_bank")
        acc_data, consent_data = provider.connect_account(user.id)

        # Check if an account already exists with this provider and account ID for this user
        existing_account = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.user_id == user.id,
                ConnectedAccount.provider == provider.get_provider_name(),
                ConnectedAccount.provider_account_id == acc_data.provider_account_id,
            )
            .first()
        )

        now = datetime.datetime.now(datetime.timezone.utc)

        if existing_account:
            existing_account.status = "ACTIVE"
            existing_account.current_balance = acc_data.current_balance
            existing_account.balance_as_of = acc_data.balance_as_of or now
            existing_account.updated_at = now

            # Ensure active consent exists
            existing_consent = (
                db.query(AccountConsent)
                .filter(
                    AccountConsent.account_id == existing_account.id,
                    AccountConsent.status == "ACTIVE",
                )
                .first()
            )
            if not existing_consent:
                new_consent = AccountConsent(
                    user_id=user.id,
                    account_id=existing_account.id,
                    provider=provider.get_provider_name(),
                    consent_id=consent_data.consent_id,
                    status="ACTIVE",
                    purpose=consent_data.purpose,
                    data_range_from=consent_data.data_range_from,
                    data_range_to=consent_data.data_range_to,
                    granted_at=consent_data.granted_at or now,
                    expires_at=consent_data.expires_at,
                )
                db.add(new_consent)

            db.commit()
            db.refresh(existing_account)
            return existing_account

        # Create new account and consent
        account = ConnectedAccount(
            user_id=user.id,
            provider=provider.get_provider_name(),
            provider_account_id=acc_data.provider_account_id,
            institution_name=acc_data.institution_name,
            account_type=acc_data.account_type,
            masked_account_number=acc_data.masked_account_number,
            currency=acc_data.currency,
            current_balance=acc_data.current_balance,
            balance_as_of=acc_data.balance_as_of or now,
            status="ACTIVE",
        )
        db.add(account)
        db.flush()  # allocate account.id

        consent = AccountConsent(
            user_id=user.id,
            account_id=account.id,
            provider=provider.get_provider_name(),
            consent_id=consent_data.consent_id,
            status="ACTIVE",
            purpose=consent_data.purpose,
            data_range_from=consent_data.data_range_from,
            data_range_to=consent_data.data_range_to,
            granted_at=consent_data.granted_at or now,
            expires_at=consent_data.expires_at,
        )
        db.add(consent)

        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def sync_account(db: Session, user: User, account_id: int) -> SyncRun:
        """
        Synchronize bank transactions and balance for a connected financial account.
        Guarantees idempotency: running twice does not produce duplicates.
        """
        account = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.id == account_id,
                ConnectedAccount.user_id == user.id,
            )
            .first()
        )
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connected financial account not found",
            )

        if account.status in ("DISCONNECTED", "REVOKED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot sync account with status '{account.status}'. Please reconnect the account first.",
            )

        now = datetime.datetime.now(datetime.timezone.utc)
        sync_run = SyncRun(
            user_id=user.id,
            account_id=account.id,
            provider=account.provider,
            status="RUNNING",
            transactions_fetched=0,
            transactions_imported=0,
            transactions_skipped=0,
            started_at=now,
        )
        db.add(sync_run)
        db.commit()
        db.refresh(sync_run)

        try:
            provider = get_bank_provider(account.provider)

            # 1. Update balance from provider
            balance, balance_as_of = provider.fetch_balance(account.provider_account_id)
            account.current_balance = balance.quantize(Decimal("0.01"))
            account.balance_as_of = balance_as_of

            # 2. Fetch transaction stream from provider
            fetched_txs = provider.fetch_transactions(account.provider_account_id)
            sync_run.transactions_fetched = len(fetched_txs)

            imported_count = 0
            skipped_count = 0

            # 3. Deduplicate and normalize
            for ptx in fetched_txs:
                # Deterministic check: provider + external_account_id + external_transaction_id
                existing_tx = (
                    db.query(Transaction)
                    .filter(
                        Transaction.provider == account.provider,
                        Transaction.external_account_id == ptx.external_account_id,
                        Transaction.external_transaction_id == ptx.external_transaction_id,
                    )
                    .first()
                )

                if existing_tx:
                    skipped_count += 1
                    continue

                # Normalization
                tx_date = ptx.transaction_date
                if tx_date.tzinfo is None:
                    tx_date = tx_date.replace(tzinfo=datetime.timezone.utc)

                # Validate and normalize category
                if ptx.transaction_type == "expense":
                    category = ptx.category if ptx.category in EXPENSE_CATEGORIES else "Other"
                else:
                    category = ptx.category if ptx.category in INCOME_CATEGORIES else "Other"

                # Validate payment method
                payment_method = ptx.payment_method if ptx.payment_method in PAYMENT_METHODS else "Bank Transfer"

                normalized_tx = Transaction(
                    user_id=user.id,
                    transaction_type=ptx.transaction_type,
                    amount=ptx.amount.quantize(Decimal("0.01")),
                    category=category,
                    description=ptx.description.strip() if ptx.description else None,
                    payment_method=payment_method,
                    transaction_date=tx_date,
                    source="BANK_SYNC",
                    provider=account.provider,
                    account_id=account.id,
                    external_transaction_id=ptx.external_transaction_id,
                    external_account_id=ptx.external_account_id,
                    raw_bank_description=ptx.raw_bank_description,
                    sync_run_id=sync_run.id,
                    imported_at=datetime.datetime.now(datetime.timezone.utc),
                )
                db.add(normalized_tx)
                imported_count += 1

            # Complete sync run
            completion_time = datetime.datetime.now(datetime.timezone.utc)
            sync_run.transactions_imported = imported_count
            sync_run.transactions_skipped = skipped_count
            sync_run.status = "SUCCESS"
            sync_run.completed_at = completion_time

            account.last_synced_at = completion_time
            account.status = "ACTIVE"

            db.commit()
            db.refresh(sync_run)
            return sync_run

        except BankProviderError as exc:
            db.rollback()
            # Mark sync run as failed in a clean transaction
            failed_run = db.query(SyncRun).filter(SyncRun.id == sync_run.id).first()
            if failed_run:
                failed_run.status = "FAILED"
                failed_run.error_message = exc.message[:500]
                failed_run.completed_at = datetime.datetime.now(datetime.timezone.utc)
                db.commit()
            raise HTTPException(
                status_code=exc.status_code,
                detail=f"Bank provider error: {exc.message}",
            )
        except Exception as exc:
            db.rollback()
            failed_run = db.query(SyncRun).filter(SyncRun.id == sync_run.id).first()
            if failed_run:
                failed_run.status = "FAILED"
                failed_run.error_message = str(exc)[:500]
                failed_run.completed_at = datetime.datetime.now(datetime.timezone.utc)
                db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unexpected internal error during bank synchronization",
            )

    @staticmethod
    def disconnect_account(db: Session, user: User, account_id: int) -> ConnectedAccount:
        """
        Disconnect an account and revoke active consent metadata.
        Does not delete historical ledger entries to preserve financial audit trail.
        """
        account = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.id == account_id,
                ConnectedAccount.user_id == user.id,
            )
            .first()
        )
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connected financial account not found",
            )

        now = datetime.datetime.now(datetime.timezone.utc)
        account.status = "DISCONNECTED"
        account.updated_at = now

        # Revoke all active consents
        active_consents = (
            db.query(AccountConsent)
            .filter(
                AccountConsent.account_id == account.id,
                AccountConsent.status == "ACTIVE",
            )
            .all()
        )
        for consent in active_consents:
            consent.status = "REVOKED"
            consent.revoked_at = now
            consent.updated_at = now

        # Inform provider (best-effort)
        try:
            provider = get_bank_provider(account.provider)
            provider.disconnect_account(account.provider_account_id)
        except Exception:
            pass

        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def get_user_accounts(db: Session, user: User) -> List[ConnectedAccount]:
        """Fetch all connected financial accounts belonging exclusively to the student."""
        return (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.user_id == user.id)
            .order_by(ConnectedAccount.created_at.desc())
            .all()
        )

    @staticmethod
    def get_account(db: Session, user: User, account_id: int) -> Optional[ConnectedAccount]:
        """Fetch a single connected account ensuring strict user ownership isolation."""
        return (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.id == account_id,
                ConnectedAccount.user_id == user.id,
            )
            .first()
        )

    @staticmethod
    def get_sync_history(db: Session, user: User, account_id: int, limit: int = 20) -> List[SyncRun]:
        """Fetch sync run audit trail for a connected account with user ownership isolation."""
        account = BankSyncService.get_account(db, user, account_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connected financial account not found",
            )

        return (
            db.query(SyncRun)
            .filter(
                SyncRun.account_id == account.id,
                SyncRun.user_id == user.id,
            )
            .order_by(SyncRun.started_at.desc())
            .limit(limit)
            .all()
        )
