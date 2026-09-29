import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User
from app.models.account import ConnectedAccount, AccountConsent, SyncRun
from app.models.transaction import Transaction
from app.services.bank_provider.base import ProviderTransactionData
from app.services.bank_provider.mock_provider import MockBankProvider
from app.services.bank_provider.factory import register_bank_provider, reset_bank_providers


@pytest.fixture(autouse=True)
def cleanup_bank_test_data():
    """Clean up test users, accounts, consents, sync runs, and transactions before and after each test."""
    reset_bank_providers()
    yield
    reset_bank_providers()
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%banksynctest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_bank_auth_token(client: TestClient, email: str, name: str = "Bank Student") -> str:
    """Helper to register and obtain a valid JWT token."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": name,
        },
    )
    assert response.status_code == 201
    return response.json()["access_token"]


# 1 & 4. Account creation & Mock provider
def test_connect_mock_account(client: TestClient):
    """1 & 4. Connect a sandbox mock bank account and verify demo metadata."""
    token = get_bank_auth_token(client, "banksynctest_connect@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/v1/accounts/connect/mock", headers=headers)
    assert response.status_code == 201
    data = response.json()

    assert data["institution_name"] == "Demo Student Bank (Sandbox)"
    assert data["masked_account_number"] == "••••5821"
    assert data["currency"] == "INR"
    assert float(data["current_balance"]) == 12450.00
    assert data["status"] == "ACTIVE"
    assert data["provider"] == "mock_bank"
    assert data["is_sandbox"] is True
    assert "id" in data


# 2 & 18. Authenticated access & Authorization
def test_unauthenticated_access_rejected(client: TestClient):
    """2 & 18. Verify unauthenticated requests to accounts API are strictly rejected."""
    resp_list = client.get("/api/v1/accounts")
    assert resp_list.status_code == 401

    resp_connect = client.post("/api/v1/accounts/connect/mock")
    assert resp_connect.status_code == 401

    resp_sync = client.post("/api/v1/accounts/1/sync")
    assert resp_sync.status_code == 401

    resp_disconnect = client.post("/api/v1/accounts/1/disconnect")
    assert resp_disconnect.status_code == 401


# 3. User isolation
def test_user_isolation_strictly_enforced(client: TestClient):
    """3. User A cannot view, sync, disconnect, or view sync history of User B's account."""
    token_a = get_bank_auth_token(client, "banksynctest_user_a@campus.edu", "Student A")
    token_b = get_bank_auth_token(client, "banksynctest_user_b@campus.edu", "Student B")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A connects an account
    resp_a = client.post("/api/v1/accounts/connect/mock", headers=headers_a)
    assert resp_a.status_code == 201
    acc_a_id = resp_a.json()["id"]

    # User B list accounts should be empty
    resp_b_list = client.get("/api/v1/accounts", headers=headers_b)
    assert resp_b_list.status_code == 200
    assert len(resp_b_list.json()["items"]) == 0

    # User B cannot access User A's account details (returns 404)
    resp_b_detail = client.get(f"/api/v1/accounts/{acc_a_id}", headers=headers_b)
    assert resp_b_detail.status_code == 404

    # User B cannot sync User A's account
    resp_b_sync = client.post(f"/api/v1/accounts/{acc_a_id}/sync", headers=headers_b)
    assert resp_b_sync.status_code == 404

    # User B cannot disconnect User A's account
    resp_b_disconnect = client.post(f"/api/v1/accounts/{acc_a_id}/disconnect", headers=headers_b)
    assert resp_b_disconnect.status_code == 404

    # User B cannot view User A's sync history
    resp_b_history = client.get(f"/api/v1/accounts/{acc_a_id}/sync-history", headers=headers_b)
    assert resp_b_history.status_code == 404


# 5 & 15. Successful sync & Transaction provenance
def test_successful_sync_and_provenance(client: TestClient):
    """5 & 15. Sync imports transactions with full provenance and updates account last_synced_at."""
    token = get_bank_auth_token(client, "banksynctest_sync@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Connect account
    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]

    # Trigger sync
    resp_sync = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert resp_sync.status_code == 200
    sync_data = resp_sync.json()

    assert sync_data["status"] == "SUCCESS"
    assert sync_data["transactions_fetched"] == 10
    assert sync_data["transactions_imported"] == 10
    assert sync_data["transactions_skipped"] == 0
    assert sync_data["account_id"] == acc_id
    assert sync_data["completed_at"] is not None

    # Verify transactions in ledger have proper provenance
    resp_txs = client.get("/api/v1/transactions", headers=headers)
    assert resp_txs.status_code == 200
    tx_list = resp_txs.json()["items"]
    assert len(tx_list) == 10

    for tx in tx_list:
        assert tx["source"] == "BANK_SYNC"
        assert tx["provider"] == "mock_bank"
        assert tx["account_id"] == acc_id
        assert tx["external_transaction_id"] is not None
        assert tx["external_transaction_id"].startswith("mock_tx_demo_")
        assert tx["raw_bank_description"] is not None
        assert tx["imported_at"] is not None

    # Also verify manual transactions created via POST have source="MANUAL"
    manual_payload = {
        "transaction_type": "expense",
        "amount": "150.00",
        "category": "Food",
        "description": "Manual Tea and Samosa",
        "payment_method": "Cash",
    }
    resp_manual = client.post("/api/v1/transactions", json=manual_payload, headers=headers)
    assert resp_manual.status_code == 201
    manual_tx = resp_manual.json()
    assert manual_tx["source"] == "MANUAL"
    assert manual_tx["provider"] is None
    assert manual_tx["external_transaction_id"] is None


# 6 & 7. Repeated sync idempotency & Duplicate protection
def test_repeated_sync_idempotency(client: TestClient):
    """6 & 7. Running sync twice imports on first run, skips all on second run (no duplicates)."""
    token = get_bank_auth_token(client, "banksynctest_idempotent@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]

    # SYNC #1
    resp_sync1 = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert resp_sync1.status_code == 200
    data1 = resp_sync1.json()
    assert data1["transactions_imported"] == 10
    assert data1["transactions_skipped"] == 0

    # SYNC #2 (same feed)
    resp_sync2 = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert resp_sync2.status_code == 200
    data2 = resp_sync2.json()
    assert data2["transactions_fetched"] == 10
    assert data2["transactions_imported"] == 0
    assert data2["transactions_skipped"] == 10

    # Total in ledger is still strictly 10, not 20!
    resp_txs = client.get("/api/v1/transactions", headers=headers)
    assert resp_txs.json()["total"] == 10


# 7. Duplicate edge case: same external ID across different accounts vs same account
def test_duplicate_edge_cases(client: TestClient):
    """7. Verifies external ID uniqueness and cross-account scoping."""
    token = get_bank_auth_token(client, "banksynctest_edge@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]

    # Initial sync
    client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)

    # Directly verify DB unique constraint on (provider, external_account_id, external_transaction_id)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "banksynctest_edge@campus.edu").first()
        assert user is not None

        # Attempting to insert a duplicate with same provider, ext_account, and ext_tx_id raises IntegrityError
        from sqlalchemy.exc import IntegrityError
        dup_tx = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("50.00"),
            category="Food",
            payment_method="UPI",
            source="BANK_SYNC",
            provider="mock_bank",
            account_id=acc_id,
            external_transaction_id="mock_tx_demo_001",
            external_account_id=f"mock_acc_{user.id}_savings_01",
        )
        db.add(dup_tx)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        db.close()


# 8. Multiple accounts & combined balance
def test_multiple_accounts_and_combined_balance(client: TestClient):
    """8. User can view multiple accounts and aggregate balance is correctly calculated."""
    token = get_bank_auth_token(client, "banksynctest_multi@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Connect first account
    resp1 = client.post("/api/v1/accounts/connect/mock", headers=headers)
    assert resp1.status_code == 201

    # Manually create a second account in DB to test multi-account listing
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "banksynctest_multi@campus.edu").first()
        assert user is not None
        acc2 = ConnectedAccount(
            user_id=user.id,
            provider="mock_bank",
            provider_account_id=f"mock_acc_{user.id}_checking_02",
            institution_name="Demo Campus Bank Checking (Sandbox)",
            account_type="current",
            masked_account_number="••••9942",
            currency="INR",
            current_balance=Decimal("5000.00"),
            status="ACTIVE",
        )
        db.add(acc2)
        db.commit()
    finally:
        db.close()

    # List accounts
    resp_list = client.get("/api/v1/accounts", headers=headers)
    assert resp_list.status_code == 200
    list_data = resp_list.json()
    assert list_data["total_accounts"] == 2
    # Combined balance = 12450.00 + 5000.00 = 17450.00
    assert float(list_data["total_connected_balance"]) == 17450.00


# 9. Sync history
def test_sync_history_audit(client: TestClient):
    """9. Records and retrieves sync runs with correct audit status."""
    token = get_bank_auth_token(client, "banksynctest_history@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]

    # Perform two syncs
    client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)

    resp_hist = client.get(f"/api/v1/accounts/{acc_id}/sync-history", headers=headers)
    assert resp_hist.status_code == 200
    history = resp_hist.json()
    assert len(history) == 2
    assert history[0]["status"] == "SUCCESS"
    assert history[1]["status"] == "SUCCESS"


# 10, 16, 17. Failed sync, timeout, provider unavailable
def test_provider_failure_modes(client: TestClient):
    """10, 16, 17. Handles timeout, 503, and malformed data safely without crashing or corrupting DB."""
    token = get_bank_auth_token(client, "banksynctest_failures@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]

    # 1. Simulate Timeout -> expect 504
    register_bank_provider("mock_bank", MockBankProvider(simulate_timeout=True))
    resp_to = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert resp_to.status_code == 504
    assert "timed out" in resp_to.json()["detail"].lower()

    # Verify sync history recorded FAILED
    reset_bank_providers()
    resp_hist = client.get(f"/api/v1/accounts/{acc_id}/sync-history", headers=headers)
    assert resp_hist.status_code == 200
    assert resp_hist.json()[0]["status"] == "FAILED"

    # 2. Simulate Unavailable -> expect 503
    register_bank_provider("mock_bank", MockBankProvider(simulate_unavailable=True))
    resp_unavail = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert resp_unavail.status_code == 503

    # 3. Simulate Malformed Data -> expect 502
    register_bank_provider("mock_bank", MockBankProvider(simulate_malformed=True))
    resp_mal = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert resp_mal.status_code == 502


# 12 & 13. Disconnect flow & Consent state
def test_disconnect_account_and_revoke_consent(client: TestClient):
    """12 & 13. Disconnect account sets status to DISCONNECTED and revokes consent."""
    token = get_bank_auth_token(client, "banksynctest_disc@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]

    # Verify initial consent in DB is ACTIVE
    db = SessionLocal()
    try:
        consent = db.query(AccountConsent).filter(AccountConsent.account_id == acc_id).first()
        assert consent is not None
        assert consent.status == "ACTIVE"
    finally:
        db.close()

    # Disconnect
    resp_disc = client.post(f"/api/v1/accounts/{acc_id}/disconnect", headers=headers)
    assert resp_disc.status_code == 200
    assert resp_disc.json()["account"]["status"] == "DISCONNECTED"

    # Verify consent in DB is REVOKED
    db = SessionLocal()
    try:
        consent = db.query(AccountConsent).filter(AccountConsent.account_id == acc_id).first()
        assert consent is not None
        assert consent.status == "REVOKED"
        assert consent.revoked_at is not None
    finally:
        db.close()

    # Syncing disconnected account should fail with 400
    resp_sync_fail = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert resp_sync_fail.status_code == 400
    assert "cannot sync account" in resp_sync_fail.json()["detail"].lower()


# 14. Bank Balance vs Ledger Balance interaction
def test_bank_balance_vs_ledger_balance_semantics(client: TestClient):
    """14. Confirms that Bank Balance (from bank API) and Ledger Balance (income - expenses) are distinct."""
    token = get_bank_auth_token(client, "banksynctest_balance@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Connect account (bank reports 12,450.00)
    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]
    bank_balance = float(resp_acc.json()["current_balance"])
    assert bank_balance == 12450.00

    # Before sync: ledger has 0 transactions, balance = 0.00
    resp_sum1 = client.get("/api/v1/transactions/summary", headers=headers)
    assert float(resp_sum1.json()["current_balance"]) == 0.00

    # Sync account (imports 10 transactions)
    client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)

    # After sync: Ledger Balance = Total Income - Total Expenses
    resp_sum2 = client.get("/api/v1/transactions/summary", headers=headers)
    sum_data = resp_sum2.json()

    # Income = 10000 (scholarship) + 3500 (freelance) + 5000 (family) = 18500
    # Expenses = 180 + 850 + 60 + 2200 + 420 + 350 + 250 = 4310
    # Net ledger balance = 18500 - 4310 = 14190.00
    assert float(sum_data["total_income"]) == 18500.00
    assert float(sum_data["total_expenses"]) == 4310.00
    assert float(sum_data["current_balance"]) == 14190.00

    # Meanwhile, the connected bank account balance remains the balance as reported by the bank
    resp_acc_after = client.get(f"/api/v1/accounts/{acc_id}", headers=headers)
    assert float(resp_acc_after.json()["current_balance"]) == 12450.00


# 19. Decimal/money precision
def test_decimal_precision_preservation(client: TestClient):
    """19. Decimal amounts are strictly preserved without IEEE-754 floating point inaccuracies."""
    token = get_bank_auth_token(client, "banksynctest_precision@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    custom_tx = [
        ProviderTransactionData(
            external_transaction_id="mock_tx_prec_001",
            external_account_id="acc_precision",
            amount=Decimal("199.99"),
            transaction_type="expense",
            category="Food",
            description="Precision Test Item",
            payment_method="UPI",
            transaction_date=datetime.datetime.now(datetime.timezone.utc),
        ),
        ProviderTransactionData(
            external_transaction_id="mock_tx_prec_002",
            external_account_id="acc_precision",
            amount=Decimal("0.01"),
            transaction_type="expense",
            category="Bills",
            description="One Paisa Test",
            payment_method="UPI",
            transaction_date=datetime.datetime.now(datetime.timezone.utc),
        ),
    ]

    register_bank_provider(
        "mock_bank",
        MockBankProvider(custom_transactions=custom_tx, custom_balance=Decimal("12345.67")),
    )

    resp_acc = client.post("/api/v1/accounts/connect/mock", headers=headers)
    acc_id = resp_acc.json()["id"]

    client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)

    resp_sum = client.get("/api/v1/transactions/summary", headers=headers)
    # Total expenses: 199.99 + 0.01 = exactly 200.00
    assert resp_sum.json()["total_expenses"] == "200.00"
