import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.state_signer import generate_consent_state, verify_consent_state
from app.models.account import ConnectedAccount, AccountConsent, SyncRun
from app.models.transaction import Transaction
from app.services.bank_provider.base import (
    BankProviderError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderAuthenticationError,
    ProviderDataError,
    ConsentRevokedError,
    ConsentExpiredError,
    ConsentRejectedError,
)
from app.services.bank_provider.factory import (
    get_bank_provider,
    register_bank_provider,
    reset_bank_providers,
)
from app.services.bank_provider.mock_provider import MockBankProvider
from app.services.bank_provider.account_aggregator_provider import AccountAggregatorProvider
from app.services.bank_sync_service import BankSyncService


from app.db.session import SessionLocal
from app.models.user import User


@pytest.fixture(autouse=True)
def cleanup_aa_test_data():
    """Clean up test providers, users, and accounts before and after each test."""
    reset_bank_providers()
    yield
    reset_bank_providers()
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_headers(client: TestClient, email: str = "aa_student@campus.edu") -> dict:
    """Helper to register a student and retrieve Authorization bearer header."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": "AA Test Student",
        },
    )
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# 1-3. Provider Configuration, Factory, and Sandbox Authentication
# =============================================================================

def test_provider_configuration_defaults():
    assert settings.BANK_PROVIDER in ("mock_bank", "setu_aa", "account_aggregator")
    assert settings.AA_BASE_URL.startswith("https://")
    assert settings.AA_TIMEOUT_SECONDS >= 5
    assert isinstance(settings.AA_SANDBOX_SIMULATE, bool)


def test_provider_factory_resolution():
    mock_prov = get_bank_provider("mock_bank")
    assert isinstance(mock_prov, MockBankProvider)
    assert mock_prov.get_provider_name() == "mock_bank"

    aa_prov = get_bank_provider("setu_aa")
    assert isinstance(aa_prov, AccountAggregatorProvider)
    assert aa_prov.get_provider_name() == "setu_aa"

    alias_prov = get_bank_provider("account_aggregator")
    assert isinstance(alias_prov, AccountAggregatorProvider)

    with pytest.raises(BankProviderError) as exc_info:
        get_bank_provider("unsupported_bank_xyz")
    assert exc_info.value.status_code == 400


def test_custom_provider_override():
    custom_mock = MockBankProvider()
    register_bank_provider("custom_test_provider", custom_mock)
    resolved = get_bank_provider("custom_test_provider")
    assert resolved is custom_mock
    reset_bank_providers()
    with pytest.raises(BankProviderError):
        get_bank_provider("custom_test_provider")


# =============================================================================
# 4-6. Consent Creation, Callback, State Verification, and Security Hardening
# =============================================================================

def test_initiate_aa_consent_endpoint(client: TestClient):
    headers = get_auth_headers(client, "aa_consent_init@campus.edu")
    resp = client.post(
        "/api/v1/accounts/consent/initiate",
        json={"provider": "setu_aa", "customer_identifier": "student_01@setu"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "consent_id" in data
    assert "authorization_url" in data
    assert "state" in data
    assert data["status"] == "PENDING"
    assert data["provider"] == "setu_aa"


def test_handle_aa_consent_callback_success(client: TestClient):
    headers = get_auth_headers(client, "aa_consent_cb@campus.edu")

    # Step 1: Initiate
    init_resp = client.post(
        "/api/v1/accounts/consent/initiate",
        json={"provider": "setu_aa"},
        headers=headers,
    )
    init_data = init_resp.json()

    # Step 2: Callback
    cb_resp = client.post(
        "/api/v1/accounts/consent/callback",
        json={
            "consent_id": init_data["consent_id"],
            "state": init_data["state"],
            "status": "ACTIVE",
        },
        headers=headers,
    )
    assert cb_resp.status_code == 200
    cb_data = cb_resp.json()
    assert cb_data["success"] is True
    assert len(cb_data["accounts"]) >= 1
    assert cb_data["accounts"][0]["institution_name"] == "State Bank of India (Setu AA Sandbox)"
    assert cb_data["accounts"][0]["status"] == "ACTIVE"
    assert cb_data["sync_result"] is not None
    assert cb_data["sync_result"]["status"] == "SUCCESS"
    assert cb_data["sync_result"]["transactions_imported"] > 0


def test_callback_fails_with_tampered_state_token(client: TestClient):
    headers = get_auth_headers(client, "tamper_test@campus.edu")

    init_resp = client.post(
        "/api/v1/accounts/consent/initiate",
        json={"provider": "setu_aa"},
        headers=headers,
    )
    init_data = init_resp.json()

    # Tamper state token signature
    parts = init_data["state"].split(".")
    tampered_state = f"{parts[0]}.forged_signature_hex_001122"

    cb_resp = client.post(
        "/api/v1/accounts/consent/callback",
        json={
            "consent_id": init_data["consent_id"],
            "state": tampered_state,
            "status": "ACTIVE",
        },
        headers=headers,
    )
    assert cb_resp.status_code == 401
    assert "signature verification failed" in cb_resp.json()["detail"].lower()


def test_callback_fails_with_expired_state_token(client: TestClient):
    headers = get_auth_headers(client, "expired_state@campus.edu")

    # Generate an expired state token (-60 seconds)
    expired_state = generate_consent_state(
        user_id=1,
        consent_id="setu_expired_001",
        expires_in_seconds=-60,
    )

    cb_resp = client.post(
        "/api/v1/accounts/consent/callback",
        json={
            "consent_id": "setu_expired_001",
            "state": expired_state,
            "status": "ACTIVE",
        },
        headers=headers,
    )
    assert cb_resp.status_code == 400
    assert "expired" in cb_resp.json()["detail"].lower()


def test_callback_strictly_enforces_user_isolation(client: TestClient):
    # Student A initiates
    headers_a = get_auth_headers(client, "student_a_cb@campus.edu")
    init_resp = client.post(
        "/api/v1/accounts/consent/initiate",
        json={"provider": "setu_aa"},
        headers=headers_a,
    )
    data_a = init_resp.json()

    # Student B attempts to submit Student A's state token callback
    headers_b = get_auth_headers(client, "student_b_cb@campus.edu")
    cb_resp = client.post(
        "/api/v1/accounts/consent/callback",
        json={
            "consent_id": data_a["consent_id"],
            "state": data_a["state"],
            "status": "ACTIVE",
        },
        headers=headers_b,
    )
    # Must be forbidden with user mismatch
    assert cb_resp.status_code == 403
    assert "user mismatch" in cb_resp.json()["detail"].lower()


# =============================================================================
# 7-10. Account & Transaction Normalization, Deduplication, and Balance
# =============================================================================

def test_account_and_transaction_normalization():
    prov = AccountAggregatorProvider(force_simulation=True)
    accs = prov.discover_accounts("test_consent_norm")
    assert len(accs) == 1
    acc = accs[0]
    assert acc.institution_name == "State Bank of India (Setu AA Sandbox)"
    assert acc.account_type == "savings"
    assert acc.masked_account_number.startswith("••••")
    assert acc.currency == "INR"
    assert acc.current_balance == Decimal("18450.75")

    txs = prov.fetch_transactions(acc.provider_account_id)
    assert len(txs) == 10
    first_tx = txs[0]
    assert first_tx.external_transaction_id == "SETU_AA_TXN_001"
    assert first_tx.amount == Decimal("320.00")
    assert first_tx.transaction_type == "expense"
    assert first_tx.category == "Food"
    assert first_tx.payment_method == "UPI"
    assert first_tx.raw_bank_description is not None


# =============================================================================
# 11-13. Idempotency: Repeated AA Sync Never Duplicates Transactions
# =============================================================================

def test_repeated_aa_sync_idempotency(client: TestClient):
    headers = get_auth_headers(client, "aa_idempotent@campus.edu")

    # Connect via AA
    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers).json()
    cb_res = client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "ACTIVE"},
        headers=headers,
    ).json()
    account_id = cb_res["accounts"][0]["id"]

    # Check transactions after initial sync
    tx_list_1 = client.get("/api/v1/transactions", headers=headers).json()
    total_after_first = tx_list_1["total"]
    assert total_after_first == 10

    # Sync a second time
    sync_res_2 = client.post(f"/api/v1/accounts/{account_id}/sync", headers=headers)
    assert sync_res_2.status_code == 200
    sync_data_2 = sync_res_2.json()
    assert sync_data_2["status"] == "SUCCESS"
    assert sync_data_2["transactions_imported"] == 0
    assert sync_data_2["transactions_skipped"] == 10

    # Verify total transactions remains exactly 10 (not 20!)
    tx_list_2 = client.get("/api/v1/transactions", headers=headers).json()
    assert tx_list_2["total"] == 10

    # Sync a third time
    sync_res_3 = client.post(f"/api/v1/accounts/{account_id}/sync", headers=headers)
    assert sync_res_3.status_code == 200
    assert sync_res_3.json()["transactions_skipped"] == 10

    tx_list_3 = client.get("/api/v1/transactions", headers=headers).json()
    assert tx_list_3["total"] == 10


# =============================================================================
# 14-19. Consent Lifecycle and Provider Failure Modes
# =============================================================================

def test_consent_rejected_mode(client: TestClient):
    headers = get_auth_headers(client, "rejected_consent@campus.edu")

    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers).json()

    # Register provider that reports REJECTED
    rejected_prov = AccountAggregatorProvider(force_simulation=True, simulate_rejected=True)
    register_bank_provider("setu_aa", rejected_prov)

    cb_res = client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "REJECTED"},
        headers=headers,
    )
    assert cb_res.status_code == 400
    assert "not approved" in cb_res.json()["detail"].lower()
    reset_bank_providers()


def test_provider_timeout_error_handling(client: TestClient):
    headers = get_auth_headers(client, "timeout_test@campus.edu")

    timeout_prov = AccountAggregatorProvider(force_simulation=True, simulate_timeout=True)
    register_bank_provider("setu_aa", timeout_prov)

    resp = client.post(
        "/api/v1/accounts/consent/initiate",
        json={"provider": "setu_aa"},
        headers=headers,
    )
    assert resp.status_code == 504
    assert "timed out" in resp.json()["detail"].lower()
    reset_bank_providers()


def test_provider_unavailable_error_handling(client: TestClient):
    headers = get_auth_headers(client, "unavailable_test@campus.edu")

    unavail_prov = AccountAggregatorProvider(force_simulation=True, simulate_unavailable=True)
    register_bank_provider("setu_aa", unavail_prov)

    resp = client.post(
        "/api/v1/accounts/consent/initiate",
        json={"provider": "setu_aa"},
        headers=headers,
    )
    assert resp.status_code == 503
    assert "unreachable" in resp.json()["detail"].lower()
    reset_bank_providers()


def test_provider_auth_failure_error_handling(client: TestClient):
    headers = get_auth_headers(client, "auth_fail_test@campus.edu")

    auth_prov = AccountAggregatorProvider(force_simulation=True, simulate_auth_failure=True)
    register_bank_provider("setu_aa", auth_prov)

    resp = client.post(
        "/api/v1/accounts/consent/initiate",
        json={"provider": "setu_aa"},
        headers=headers,
    )
    assert resp.status_code == 401
    assert "credentials" in resp.json()["detail"].lower()
    reset_bank_providers()


def test_provider_malformed_data_error_handling(client: TestClient):
    headers = get_auth_headers(client, "malformed_test@campus.edu")

    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers).json()
    cb_res = client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "ACTIVE"},
        headers=headers,
    ).json()
    acc_id = cb_res["accounts"][0]["id"]

    malformed_prov = AccountAggregatorProvider(force_simulation=True, simulate_malformed=True)
    register_bank_provider("setu_aa", malformed_prov)

    sync_res = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert sync_res.status_code == 502
    assert "malformed" in sync_res.json()["detail"].lower()
    reset_bank_providers()


def test_sync_blocked_when_consent_revoked(client: TestClient):
    headers = get_auth_headers(client, "revoked_test@campus.edu")

    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers).json()
    cb_res = client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "ACTIVE"},
        headers=headers,
    ).json()
    acc_id = cb_res["accounts"][0]["id"]

    # Disconnect account / revoke consent
    client.post(f"/api/v1/accounts/{acc_id}/disconnect", headers=headers)

    # Attempting to sync disconnected account must return 400
    sync_res = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert sync_res.status_code == 400
    assert "DISCONNECTED" in sync_res.json()["detail"]


# =============================================================================
# 20-22. User Ownership and Isolation Enforcement
# =============================================================================

def test_user_cannot_access_or_sync_another_students_account(client: TestClient):
    headers_user1 = get_auth_headers(client, "user1_acc@campus.edu")
    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers_user1).json()
    cb_res = client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "ACTIVE"},
        headers=headers_user1,
    ).json()
    acc1_id = cb_res["accounts"][0]["id"]

    headers_user2 = get_auth_headers(client, "user2_acc@campus.edu")

    # User 2 tries to GET User 1's account -> 404
    get_res = client.get(f"/api/v1/accounts/{acc1_id}", headers=headers_user2)
    assert get_res.status_code == 404

    # User 2 tries to SYNC User 1's account -> 404
    sync_res = client.post(f"/api/v1/accounts/{acc1_id}/sync", headers=headers_user2)
    assert sync_res.status_code == 404

    # User 2 tries to DISCONNECT User 1's account -> 404
    disc_res = client.post(f"/api/v1/accounts/{acc1_id}/disconnect", headers=headers_user2)
    assert disc_res.status_code == 404

    # User 2 tries to view sync history -> 404
    hist_res = client.get(f"/api/v1/accounts/{acc1_id}/sync-history", headers=headers_user2)
    assert hist_res.status_code == 404


# =============================================================================
# 23-24. Webhook Processing and Signature Verification
# =============================================================================

def test_setu_webhook_revocation_processing(client: TestClient):
    headers = get_auth_headers(client, "webhook_test@campus.edu")
    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers).json()
    cb_res = client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "ACTIVE"},
        headers=headers,
    ).json()
    consent_id = init_res["consent_id"]

    # Incoming Setu AA webhook event: consent REVOKED
    hook_payload = {
        "event": "CONSENT_STATUS_UPDATE",
        "data": {
            "consentId": consent_id,
            "status": "REVOKED",
        },
    }
    hook_resp = client.post("/api/v1/accounts/webhook/setu", json=hook_payload)
    assert hook_resp.status_code == 200
    assert hook_resp.json()["success"] is True

    # Check that account is marked REVOKED in user account list
    acc_list = client.get("/api/v1/accounts", headers=headers).json()
    account = next((a for a in acc_list["items"] if a["id"] == cb_res["accounts"][0]["id"]), None)
    assert account is not None
    assert account["status"] == "REVOKED"


# =============================================================================
# 25-31. Decimal Precision, Provenance, and AI Copilot Integration
# =============================================================================

def test_decimal_precision_preservation_in_aa_sync(client: TestClient):
    headers = get_auth_headers(client, "decimal_aa@campus.edu")
    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers).json()
    cb_res = client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "ACTIVE"},
        headers=headers,
    ).json()
    account = cb_res["accounts"][0]
    # Current balance precision
    assert Decimal(str(account["current_balance"])) == Decimal("18450.75")


def test_ai_copilot_awareness_of_connected_bank_vs_ledger(client: TestClient):
    headers = get_auth_headers(client, "ai_bank_aware@campus.edu")

    # Before connecting bank
    res_pre = client.post("/api/v1/ai/copilot", json={"message": "Is my bank connected?"}, headers=headers)
    assert res_pre.status_code == 200
    chat_pre = res_pre.json()
    assert "do not currently have any active bank accounts" in chat_pre["answer"]

    # Connect AA bank account
    init_res = client.post("/api/v1/accounts/consent/initiate", json={"provider": "setu_aa"}, headers=headers).json()
    client.post(
        "/api/v1/accounts/consent/callback",
        json={"consent_id": init_res["consent_id"], "state": init_res["state"], "status": "ACTIVE"},
        headers=headers,
    )

    # After connecting bank
    res_post = client.post("/api/v1/ai/copilot", json={"message": "What is my bank account balance?"}, headers=headers)
    assert res_post.status_code == 200
    chat_post = res_post.json()
    assert "Account Aggregator" in chat_post["answer"]
    assert "18450.75" in chat_post["answer"] or "18,450.75" in chat_post["answer"]
    assert "ledger balance" in chat_post["answer"].lower()
