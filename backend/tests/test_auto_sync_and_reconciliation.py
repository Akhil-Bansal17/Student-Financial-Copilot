import datetime
from decimal import Decimal
import json
import uuid
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.models.account import ConnectedAccount, AccountConsent, SyncRun
from app.models.transaction import Transaction
from app.models.reconciliation import TransactionReconciliation
from app.services.bank_provider.base import (
    BankDataProvider,
    BankProviderError,
    ProviderAccountData,
    ProviderConsentData,
    ProviderTransactionData,
)
from app.services.bank_provider.factory import register_bank_provider, reset_bank_providers
from app.services.bank_sync_service import BankSyncService
from app.services.bank_sync_scheduler import BankSyncScheduler, scheduler
from app.services.reconciliation_service import TransactionReconciliationService


@pytest.fixture(autouse=True)
def cleanup_reconciliation_test_data():
    """Reset providers and purge test data before and after each test."""
    reset_bank_providers()
    yield
    reset_bank_providers()
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%reconcile_%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str, name: str = "Test Student") -> str:
    """Helper to register and retrieve JWT bearer token."""
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": name,
        },
    )
    assert res.status_code == 201, f"Registration failed: {res.text}"
    return res.json()["access_token"]


class CustomMockProvider(BankDataProvider):
    """Configurable bank data provider for testing reconciliation and retry scenarios."""

    def __init__(self, name: str = "custom_test_bank"):
        self.provider_name = name
        self.balance = Decimal("15000.00")
        self.transactions: list[ProviderTransactionData] = []
        self.fail_mode: str = "none"  # "none", "transient", "permanent"

    def get_provider_name(self) -> str:
        return self.provider_name

    def connect_account(self, user_id: int):
        acc = ProviderAccountData(
            provider_account_id=f"acc_{user_id}",
            institution_name="Apex Student Bank",
            account_type="savings",
            masked_account_number="XXXX-7788",
            currency="INR",
            current_balance=self.balance,
            balance_as_of=datetime.datetime.now(datetime.timezone.utc),
        )
        cons = ProviderConsentData(
            consent_id=f"cons_{user_id}",
            purpose="Testing",
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=90),
        )
        return acc, cons

    def fetch_balance(self, provider_account_id: str):
        if self.fail_mode == "transient":
            raise BankProviderError("Service temporarily unavailable", status_code=503)
        if self.fail_mode == "permanent":
            raise BankProviderError("Consent revoked or expired", status_code=401)
        return self.balance, datetime.datetime.now(datetime.timezone.utc)

    def fetch_transactions(self, provider_account_id: str, from_date=None, to_date=None):
        if self.fail_mode == "transient":
            raise BankProviderError("Service temporarily unavailable", status_code=503)
        if self.fail_mode == "permanent":
            raise BankProviderError("Consent revoked or expired", status_code=401)
        return self.transactions

    def disconnect_account(self, provider_account_id: str):
        return True


def test_scheduler_configuration():
    """Verify background scheduler configuration values and defaults."""
    assert hasattr(settings, "BANK_SYNC_ENABLED")
    assert hasattr(settings, "BANK_SYNC_INTERVAL_MINUTES")
    assert hasattr(settings, "BANK_SYNC_LOCK_TIMEOUT_SECONDS")
    assert hasattr(settings, "BANK_SYNC_MAX_RETRIES")
    assert settings.BANK_SYNC_INTERVAL_MINUTES > 0
    assert settings.BANK_SYNC_LOCK_TIMEOUT_SECONDS >= 60


def test_scheduler_lifecycle():
    """Verify scheduler start and stop methods execute without exceptions."""
    sched = BankSyncScheduler()
    sched.start()
    assert sched._running is True
    sched.stop()
    assert sched._running is False


def test_auto_sync_eligibility_active_account(client: TestClient):
    """Active account with valid consent and elapsed time is eligible for auto sync."""
    email = f"reconcile_elig_{uuid.uuid4().hex[:6]}@campus.edu"
    token = get_auth_token(client, email)

    # Connect account
    res = client.post("/api/v1/accounts/connect/mock", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    acc_id = res.json()["id"]

    db = SessionLocal()
    try:
        acc = db.query(ConnectedAccount).filter(ConnectedAccount.id == acc_id).first()
        acc.last_synced_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=30)
        db.commit()

        eligible = BankSyncScheduler.get_eligible_accounts(db)
        eligible_ids = [a.id for a in eligible]
        assert acc_id in eligible_ids
    finally:
        db.close()


def test_auto_sync_ineligibility_inactive_or_expired(client: TestClient):
    """Disconnected accounts or accounts with expired consents must be skipped by scheduler."""
    email = f"reconcile_inelig_{uuid.uuid4().hex[:6]}@campus.edu"
    token = get_auth_token(client, email)

    res = client.post("/api/v1/accounts/connect/mock", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    acc_id = res.json()["id"]

    db = SessionLocal()
    try:
        # Case A: Disconnected account
        acc = db.query(ConnectedAccount).filter(ConnectedAccount.id == acc_id).first()
        acc.status = "DISCONNECTED"
        db.commit()

        eligible = BankSyncScheduler.get_eligible_accounts(db)
        assert acc_id not in [a.id for a in eligible]

        # Case B: Expired consent
        acc.status = "ACTIVE"
        consent = db.query(AccountConsent).filter(AccountConsent.account_id == acc.id).first()
        consent.expires_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
        db.commit()

        eligible = BankSyncScheduler.get_eligible_accounts(db)
        assert acc_id not in [a.id for a in eligible]
    finally:
        db.close()


def test_concurrent_sync_protection(client: TestClient):
    """Concurrent sync attempts on an actively locked account must return 409 Conflict."""
    email = f"reconcile_lock_{uuid.uuid4().hex[:6]}@campus.edu"
    token = get_auth_token(client, email)

    res = client.post("/api/v1/accounts/connect/mock", headers={"Authorization": f"Bearer {token}"})
    acc_id = res.json()["id"]

    db = SessionLocal()
    try:
        # Manually acquire lock as if another worker is syncing right now
        acc = db.query(ConnectedAccount).filter(ConnectedAccount.id == acc_id).first()
        acc.sync_lock_at = datetime.datetime.now(datetime.timezone.utc)
        acc.sync_lock_token = "external_worker_token"
        db.commit()

        # Attempt sync via API -> Must receive 409 Conflict
        sync_res = client.post(
            f"/api/v1/accounts/{acc_id}/sync",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert sync_res.status_code == 409
        assert "in progress" in sync_res.json()["detail"].lower()

        # If lock expires (older than timeout), sync should succeed
        acc = db.query(ConnectedAccount).filter(ConnectedAccount.id == acc_id).first()
        acc.sync_lock_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=10)
        db.commit()

        sync_res2 = client.post(
            f"/api/v1/accounts/{acc_id}/sync",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert sync_res2.status_code == 200
    finally:
        db.close()


def test_transient_failure_and_exponential_backoff(client: TestClient):
    """Transient provider failures must increment retry count and set exponential next_retry_at."""
    email = f"reconcile_retry_{uuid.uuid4().hex[:6]}@campus.edu"
    token = get_auth_token(client, email)

    mock_prov = CustomMockProvider("custom_test_bank")
    register_bank_provider("custom_test_bank", mock_prov)

    # Create account with custom provider
    db = SessionLocal()
    try:
        user = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        user_id = user["id"]

        acc = ConnectedAccount(
            user_id=user_id,
            provider="custom_test_bank",
            provider_account_id=f"acc_{user_id}",
            institution_name="Apex Bank",
            account_type="savings",
            masked_account_number="XXXX-1234",
            status="ACTIVE",
        )
        db.add(acc)
        db.flush()

        consent = AccountConsent(
            user_id=user_id,
            account_id=acc.id,
            provider="custom_test_bank",
            consent_id=f"cons_{user_id}",
            status="ACTIVE",
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30),
        )
        db.add(consent)
        db.commit()
        acc_id = acc.id

        # Trigger sync with transient failure
        mock_prov.fail_mode = "transient"
        sync_res = client.post(
            f"/api/v1/accounts/{acc_id}/sync",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert sync_res.status_code == 503

        # Check account state
        db.refresh(acc)
        assert acc.last_sync_status == "FAILED"
        assert acc.sync_retry_count == 1
        assert acc.next_retry_at is not None
        assert acc.next_retry_at > datetime.datetime.now(datetime.timezone.utc)
    finally:
        db.close()


def test_reconciliation_high_confidence_auto_match(client: TestClient):
    """
    When user manually logs an expense and bank sync returns the exact same amount and day
    with matching description tokens, it should automatically reconcile into 1 ledger row.
    """
    email = f"reconcile_auto_{uuid.uuid4().hex[:6]}@campus.edu"
    token = get_auth_token(client, email)

    today = datetime.datetime.now(datetime.timezone.utc)

    # 1. User manually creates transaction
    manual_res = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "450.00",
            "category": "Food",
            "description": "Swiggy lunch with roommate",
            "payment_method": "UPI",
            "transaction_date": today.isoformat(),
        },
    )
    assert manual_res.status_code == 201
    manual_id = manual_res.json()["id"]

    # 2. Configure provider to return matching bank transaction
    mock_prov = CustomMockProvider("custom_test_bank")
    mock_prov.transactions = [
        ProviderTransactionData(
            external_transaction_id="TX_SWIGGY_101",
            external_account_id="acc_test",
            amount=Decimal("450.00"),
            transaction_type="expense",
            category="Food",
            description="SWIGGY BANGALORE",
            payment_method="UPI",
            transaction_date=today,
            raw_bank_description="UPI/2026/Swiggy/5431",
        )
    ]
    register_bank_provider("custom_test_bank", mock_prov)

    # Create account and sync
    db = SessionLocal()
    try:
        user = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        acc = ConnectedAccount(
            user_id=user["id"],
            provider="custom_test_bank",
            provider_account_id=f"acc_{user['id']}",
            institution_name="Student Bank",
            status="ACTIVE",
            masked_account_number="XXXX-9999",
        )
        db.add(acc)
        db.commit()

        # Run sync
        sync_run = BankSyncService.sync_account(db, db.query(User).filter(User.id == user["id"]).first(), acc.id)
        assert sync_run.status == "SUCCESS"
        assert sync_run.transactions_reconciled == 1
        assert sync_run.transactions_imported == 0

        # Verify ledger has only 1 transaction total (no duplicate created!)
        txs = db.query(Transaction).filter(Transaction.user_id == user["id"]).all()
        assert len(txs) == 1
        assert txs[0].id == manual_id
        assert txs[0].source == "RECONCILED"
        assert txs[0].reconciliation_status == "RECONCILED"
        assert txs[0].external_transaction_id == "TX_SWIGGY_101"

        # Verify reconciliation record created
        rec = db.query(TransactionReconciliation).filter(TransactionReconciliation.manual_transaction_id == manual_id).first()
        assert rec is not None
        assert rec.status == "AUTO_RECONCILED"
        assert rec.confidence_score >= Decimal("0.85")
    finally:
        db.close()


def test_reconciliation_possible_match_and_user_match(client: TestClient):
    """
    Ambiguous match (same amount and date, but divergent description) creates PENDING_REVIEW.
    User clicking [Match] resolves it into a single reconciled transaction.
    """
    email = f"reconcile_ambig_{uuid.uuid4().hex[:6]}@campus.edu"
    token = get_auth_token(client, email)
    today = datetime.datetime.now(datetime.timezone.utc)

    # 1. Manual transaction
    manual_res = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "500.00",
            "category": "Other",
            "description": "General expense",
            "payment_method": "Cash",
            "transaction_date": today.isoformat(),
        },
    )
    manual_id = manual_res.json()["id"]

    # 2. Bank transaction with same amount and date but totally different description
    mock_prov = CustomMockProvider("custom_test_bank")
    mock_prov.transactions = [
        ProviderTransactionData(
            external_transaction_id="TX_UNKNOWN_500",
            external_account_id="acc_test",
            amount=Decimal("500.00"),
            transaction_type="expense",
            category="Other",
            description="MERCHANT XYZ POS",
            payment_method="Bank Transfer",
            transaction_date=today,
            raw_bank_description="POS/MERCHANT_XYZ",
        )
    ]
    register_bank_provider("custom_test_bank", mock_prov)

    db = SessionLocal()
    try:
        user = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        acc = ConnectedAccount(
            user_id=user["id"],
            provider="custom_test_bank",
            provider_account_id=f"acc_{user['id']}",
            institution_name="Student Bank",
            status="ACTIVE",
            masked_account_number="XXXX-9999",
        )
        db.add(acc)
        db.commit()

        # Run sync
        sync_run = BankSyncService.sync_account(db, db.query(User).filter(User.id == user["id"]).first(), acc.id)
        assert sync_run.status == "SUCCESS"
        assert sync_run.transactions_pending_review == 1

        # 3. Check pending reviews endpoint
        pending_res = client.get("/api/v1/reconciliation/pending", headers={"Authorization": f"Bearer {token}"})
        assert pending_res.status_code == 200
        pending_list = pending_res.json()
        assert len(pending_list) == 1
        rec_id = pending_list[0]["id"]
        assert pending_list[0]["status"] == "PENDING_REVIEW"

        # Ledger still has only the original manual transaction
        txs = db.query(Transaction).filter(Transaction.user_id == user["id"]).all()
        assert len(txs) == 1

        # 4. User confirms [Match]
        match_res = client.post(f"/api/v1/reconciliation/{rec_id}/match", headers={"Authorization": f"Bearer {token}"})
        assert match_res.status_code == 200
        assert match_res.json()["status"] == "MATCHED"

        # Ledger still has 1 transaction, now marked RECONCILED
        db.expire_all()
        tx = db.query(Transaction).filter(Transaction.id == manual_id).first()
        assert tx.source == "RECONCILED"
        assert tx.reconciliation_status == "RECONCILED"
    finally:
        db.close()


def test_reconciliation_keep_separate_action(client: TestClient):
    """
    When user selects [Keep Separate], the bank transaction is inserted as a genuine
    new ledger row, leaving 2 distinct transactions in the ledger.
    """
    email = f"reconcile_sep_{uuid.uuid4().hex[:6]}@campus.edu"
    token = get_auth_token(client, email)
    today = datetime.datetime.now(datetime.timezone.utc)

    # 1. Manual transaction
    manual_res = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "600.00",
            "category": "Food",
            "description": "Coffee shop",
            "payment_method": "Cash",
            "transaction_date": today.isoformat(),
        },
    )
    manual_id = manual_res.json()["id"]

    mock_prov = CustomMockProvider("custom_test_bank")
    mock_prov.transactions = [
        ProviderTransactionData(
            external_transaction_id="TX_SEP_600",
            external_account_id="acc_test",
            amount=Decimal("600.00"),
            transaction_type="expense",
            category="Other",
            description="Bookstore",
            payment_method="Bank Transfer",
            transaction_date=today,
        )
    ]
    register_bank_provider("custom_test_bank", mock_prov)

    db = SessionLocal()
    try:
        user = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        acc = ConnectedAccount(
            user_id=user["id"],
            provider="custom_test_bank",
            provider_account_id=f"acc_{user['id']}",
            institution_name="Student Bank",
            status="ACTIVE",
            masked_account_number="XXXX-9999",
        )
        db.add(acc)
        db.commit()

        # Run sync
        BankSyncService.sync_account(db, db.query(User).filter(User.id == user["id"]).first(), acc.id)

        # Get pending reconciliation
        pending_res = client.get("/api/v1/reconciliation/pending", headers={"Authorization": f"Bearer {token}"})
        rec_id = pending_res.json()[0]["id"]

        # Call [Keep Separate]
        sep_res = client.post(f"/api/v1/reconciliation/{rec_id}/keep-separate", headers={"Authorization": f"Bearer {token}"})
        assert sep_res.status_code == 200
        assert sep_res.json()["status"] == "SEPARATE"

        # Verify ledger now contains both transactions
        db.expire_all()
        txs = db.query(Transaction).filter(Transaction.user_id == user["id"]).all()
        assert len(txs) == 2
    finally:
        db.close()


def test_reconciliation_user_isolation(client: TestClient):
    """User B cannot view or resolve User A's pending reconciliations."""
    token_a = get_auth_token(client, f"reconcile_iso_a_{uuid.uuid4().hex[:6]}@campus.edu")
    token_b = get_auth_token(client, f"reconcile_iso_b_{uuid.uuid4().hex[:6]}@campus.edu")

    today = datetime.datetime.now(datetime.timezone.utc)
    # User A creates a transaction
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "transaction_type": "expense",
            "amount": "300.00",
            "category": "Food",
            "description": "Snacks",
            "payment_method": "Cash",
            "transaction_date": today.isoformat(),
        },
    )

    mock_prov = CustomMockProvider("custom_test_bank")
    mock_prov.transactions = [
        ProviderTransactionData(
            external_transaction_id="TX_ISO_300",
            external_account_id="acc_a",
            amount=Decimal("300.00"),
            transaction_type="expense",
            category="Other",
            description="Other store",
            payment_method="UPI",
            transaction_date=today,
        )
    ]
    register_bank_provider("custom_test_bank", mock_prov)

    db = SessionLocal()
    try:
        user_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
        acc = ConnectedAccount(
            user_id=user_a["id"],
            provider="custom_test_bank",
            provider_account_id=f"acc_{user_a['id']}",
            institution_name="Bank A",
            status="ACTIVE",
            masked_account_number="XXXX-1111",
        )
        db.add(acc)
        db.commit()

        BankSyncService.sync_account(db, db.query(User).filter(User.id == user_a["id"]).first(), acc.id)

        # User A has 1 pending
        pending_a = client.get("/api/v1/reconciliation/pending", headers={"Authorization": f"Bearer {token_a}"}).json()
        assert len(pending_a) == 1
        rec_id = pending_a[0]["id"]

        # User B sees 0 pending
        pending_b = client.get("/api/v1/reconciliation/pending", headers={"Authorization": f"Bearer {token_b}"}).json()
        assert len(pending_b) == 0

        # User B cannot match User A's reconciliation
        steal_res = client.post(f"/api/v1/reconciliation/{rec_id}/match", headers={"Authorization": f"Bearer {token_b}"})
        assert steal_res.status_code == 404
    finally:
        db.close()


def test_reconciliation_status_and_summary_endpoints(client: TestClient):
    """Verify GET /reconciliation/status and /summary return accurate numbers."""
    token = get_auth_token(client, f"reconcile_status_{uuid.uuid4().hex[:6]}@campus.edu")

    # Initially empty
    res = client.get("/api/v1/reconciliation/status", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_connected_accounts"] == 0
    assert data["sync_status"] == "NO_ACCOUNTS"

    sum_res = client.get("/api/v1/reconciliation/summary", headers={"Authorization": f"Bearer {token}"})
    assert sum_res.status_code == 200
    assert sum_res.json()["pending_count"] == 0


def test_scheduler_run_sync_cycle_batch(client: TestClient):
    """Verify BankSyncScheduler.run_sync_cycle() processes multiple eligible accounts."""
    token = get_auth_token(client, f"reconcile_cycle_{uuid.uuid4().hex[:6]}@campus.edu")
    client.post("/api/v1/accounts/connect/mock", headers={"Authorization": f"Bearer {token}"})

    db = SessionLocal()
    try:
        user = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        acc = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user["id"]).first()
        assert acc is not None
        acc.last_synced_at = None
        db.commit()

        result = BankSyncScheduler.run_sync_cycle(db)
        assert result["status"] == "COMPLETED"
        assert result["accounts_synced"] >= 1
    finally:
        db.close()


def test_ai_copilot_sync_freshness_awareness(client: TestClient):
    """AI Copilot recognizes connected bank data and warns if sync is stale."""
    token = get_auth_token(client, f"reconcile_ai_{uuid.uuid4().hex[:6]}@campus.edu")
    client.post("/api/v1/accounts/connect/mock", headers={"Authorization": f"Bearer {token}"})

    db = SessionLocal()
    try:
        user = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        acc = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user["id"]).first()
        assert acc is not None
        acc.last_synced_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=15)
        db.commit()

        ai_res = client.post(
            "/api/v1/ai/copilot",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "What is my connected bank status?"},
        )
        assert ai_res.status_code == 200
        reply = ai_res.json()["answer"]
        assert "connected account" in reply.lower()
        assert "stale" in reply.lower()
    finally:
        db.close()
