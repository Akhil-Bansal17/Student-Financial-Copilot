import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.models.user import User
from app.models.account import ConnectedAccount, AccountConsent
from app.models.transaction import Transaction
from app.models.merchant_preference import MerchantCategoryPreference
from app.models.budget import Budget
from app.db.session import SessionLocal
from app.services.transaction_normalization_service import TransactionNormalizationService
from app.services.categorization_service import CategorizationService
from app.services.merchant_preference_service import MerchantPreferenceService
from app.services.bank_provider.base import ProviderTransactionData
from app.services.bank_provider.factory import register_bank_provider, reset_bank_providers
from app.services.bank_provider.mock_provider import MockBankProvider
from app.services.bank_sync_service import BankSyncService
from app.services.financial_context_builder import FinancialContextBuilder


@pytest.fixture(autouse=True)
def cleanup_test_data():
    """Clean up test users, accounts, and preferences before and after each test."""
    reset_bank_providers()
    yield
    reset_bank_providers()
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("intel_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def get_auth_headers(client: TestClient, email: str = "intel_student@campus.edu") -> dict:
    """Helper to register a student and retrieve Authorization bearer header."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": "Intelligence Test Student",
        },
    )
    if resp.status_code == 201:
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------
# 1. Normalization & Safety Unit Tests (1-5, 32-34)
# --------------------------------------------------------------------------

def test_merchant_normalization_standard_patterns():
    """1. Standard UPI and POS merchant extraction."""
    # UPI slash format
    norm, disp = TransactionNormalizationService.extract_merchant("UPI/CR/82910281/CAMPUS CANTEEN/UTIB000123")
    assert norm == "CAMPUS CANTEEN"
    assert "CAMPUS CANTEEN" in disp

    # UPI hyphen format
    norm, disp = TransactionNormalizationService.extract_merchant("UPI-UBER-TRIP-928372")
    assert norm == "UBER"

    # Known alias mapping
    norm, disp = TransactionNormalizationService.extract_merchant("AMZN MKTPLACE PMTS")
    assert norm == "AMAZON"

    # Swiggy order
    norm, disp = TransactionNormalizationService.extract_merchant("UPI/SWIGGY/123456789/ORDER")
    assert norm == "SWIGGY"


def test_malformed_merchant_descriptions():
    """2. Malformed or excessively punctuated descriptions."""
    norm, _ = TransactionNormalizationService.extract_merchant("///...///---***")
    assert norm is None

    norm, _ = TransactionNormalizationService.extract_merchant("")
    assert norm is None


def test_upi_reference_and_ifsc_removal():
    """3. Stripping 6-16 digit reference numbers and bank IFSC codes."""
    norm, _ = TransactionNormalizationService.extract_merchant("UPI/CR/992817263541/METRO RAIL CORP/PUNB0004512")
    assert norm == "METRO RAIL"


def test_punctuation_and_whitespace_normalization():
    """4. Punctuation and whitespace normalization."""
    cleaned = TransactionNormalizationService.clean_text("   Hostel \t\t  Mess   \n Management   ")
    assert cleaned == "Hostel Mess Management"


def test_conservative_normalization_safety():
    """5. Conservative safety: do not truncate sentences with critical context."""
    text = "Payment sent towards college tuition fee installment 2"
    norm, _ = TransactionNormalizationService.extract_merchant(raw_description=None, description=text)
    # Does not falsely attribute to random merchant
    assert norm is None or norm != "AMAZON"


def test_refund_and_reversal_detection():
    """32-34. Safe detection of refund and reversal events."""
    is_ref, is_rev = TransactionNormalizationService.detect_refund_or_reversal("Amazon order refund", None)
    assert is_ref is True
    assert is_rev is False

    is_ref, is_rev = TransactionNormalizationService.detect_refund_or_reversal("Payment reversal from ATM", None)
    assert is_ref is False
    assert is_rev is True


# --------------------------------------------------------------------------
# 2. Deterministic Categorization Unit Tests (6-12)
# --------------------------------------------------------------------------

def test_deterministic_category_suggestions():
    """6-8. Categorization produces high-confidence and low-confidence outputs."""
    db = SessionLocal()
    try:
        # High confidence expense
        res = CategorizationService.categorize(
            db=db,
            user_id=1,
            transaction_type="expense",
            normalized_merchant="SWIGGY",
        )
        assert res.category == "Food"
        assert res.confidence == "HIGH"
        assert res.source == "RULE_HIGH"

        # High confidence transport
        res_transport = CategorizationService.categorize(
            db=db,
            user_id=1,
            transaction_type="expense",
            normalized_merchant="UBER",
        )
        assert res_transport.category == "Transport"
        assert res_transport.confidence == "HIGH"

        # Low confidence fallback
        res_unknown = CategorizationService.categorize(
            db=db,
            user_id=1,
            transaction_type="expense",
            normalized_merchant="UNKNOWN_SHOP_XYZ",
        )
        assert res_unknown.category == "Other"
        assert res_unknown.confidence == "LOW"
        assert res_unknown.source == "DEFAULT"
    finally:
        db.close()


def test_user_category_preference_override():
    """9-10. User category preference overrides generic rules."""
    db = SessionLocal()
    try:
        # Create a test user
        user = User(email="intel_pref@campus.edu", password_hash="hash")
        db.add(user)
        db.commit()
        db.refresh(user)

        # Set user preference: SWIGGY -> Other (instead of default Food)
        pref = MerchantCategoryPreference(
            user_id=user.id,
            normalized_merchant="SWIGGY",
            category="Other",
        )
        db.add(pref)
        db.commit()

        # Categorization must respect user preference
        res = CategorizationService.categorize(
            db=db,
            user_id=user.id,
            transaction_type="expense",
            normalized_merchant="SWIGGY",
        )
        assert res.category == "Other"
        assert res.confidence == "HIGH"
        assert res.source == "USER_PREFERENCE"
    finally:
        db.close()


def test_user_isolation_for_preferences():
    """11. User A preference does not affect User B."""
    db = SessionLocal()
    try:
        user_a = User(email="intel_a@campus.edu", password_hash="hash")
        user_b = User(email="intel_b@campus.edu", password_hash="hash")
        db.add_all([user_a, user_b])
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)

        # User A sets UBER -> Entertainment
        MerchantPreferenceService.set_preference(db, user_a, "UBER", "Entertainment")

        # User B categorizing UBER should still get Transport (Rule High)
        res_b = CategorizationService.categorize(
            db=db,
            user_id=user_b.id,
            transaction_type="expense",
            normalized_merchant="UBER",
        )
        assert res_b.category == "Transport"
        assert res_b.source == "RULE_HIGH"
    finally:
        db.close()


def test_manual_category_preservation():
    """12. If transaction category was set by USER_MANUAL, it is never overwritten."""
    db = SessionLocal()
    try:
        res = CategorizationService.categorize(
            db=db,
            user_id=1,
            transaction_type="expense",
            normalized_merchant="SWIGGY",
            existing_category="Bills",
            existing_source="USER_MANUAL",
        )
        assert res.category == "Bills"
        assert res.source == "USER_MANUAL"
        assert res.confidence == "HIGH"
    finally:
        db.close()


# --------------------------------------------------------------------------
# 3. Preference API & Tenancy Tests (11, 35-38)
# --------------------------------------------------------------------------

def test_merchant_preference_api_crud_and_tenancy(client: TestClient):
    """Authenticated CRUD and tenancy isolation for merchant preferences."""
    headers_a = get_auth_headers(client, "intel_user_a@campus.edu")
    headers_b = get_auth_headers(client, "intel_user_b@campus.edu")

    # 1. User A creates preference
    resp = client.post(
        "/api/v1/merchant-preferences",
        json={"normalized_merchant": "swiggy", "category": "Other"},
        headers=headers_a,
    )
    assert resp.status_code == 201
    pref_data = resp.json()
    assert pref_data["normalized_merchant"] == "SWIGGY"
    assert pref_data["category"] == "Other"
    pref_id = pref_data["id"]

    # 2. User A lists preferences
    list_resp = client.get("/api/v1/merchant-preferences", headers=headers_a)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 3. User B cannot see User A's preference
    list_b_resp = client.get("/api/v1/merchant-preferences", headers=headers_b)
    assert list_b_resp.status_code == 200
    assert len(list_b_resp.json()) == 0

    # 4. User B cannot update User A's preference (IDOR test)
    idor_put = client.put(
        f"/api/v1/merchant-preferences/{pref_id}",
        json={"category": "Food"},
        headers=headers_b,
    )
    assert idor_put.status_code == 404

    # 5. User B cannot delete User A's preference (IDOR test)
    idor_del = client.delete(
        f"/api/v1/merchant-preferences/{pref_id}",
        headers=headers_b,
    )
    assert idor_del.status_code == 404

    # 6. Invalid category rejected
    bad_cat = client.post(
        "/api/v1/merchant-preferences",
        json={"normalized_merchant": "NETFLIX", "category": "InvalidCategory123"},
        headers=headers_a,
    )
    assert bad_cat.status_code == 422

    # 7. User A updates own preference
    update_resp = client.put(
        f"/api/v1/merchant-preferences/{pref_id}",
        json={"category": "Entertainment"},
        headers=headers_a,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["category"] == "Entertainment"

    # 8. User A deletes preference
    del_resp = client.delete(f"/api/v1/merchant-preferences/{pref_id}", headers=headers_a)
    assert del_resp.status_code == 200
    assert len(client.get("/api/v1/merchant-preferences", headers=headers_a).json()) == 0


# --------------------------------------------------------------------------
# 4. Transaction Creation, Update, and Provenance Safeguards (14, 15, 35)
# --------------------------------------------------------------------------

def test_transaction_create_and_detail_intelligence(client: TestClient):
    """14. Transaction detail API returns merchant intelligence and status."""
    headers = get_auth_headers(client, "intel_tx_detail@campus.edu")

    # Create transaction with merchant in description
    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": 250.00,
            "category": "Food",
            "description": "UPI/SWIGGY/998877/ORDER",
            "payment_method": "UPI",
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    tx_data = create_resp.json()
    tx_id = tx_data["id"]
    assert tx_data["normalized_merchant"] == "SWIGGY"
    assert tx_data["status"] == "POSTED"
    assert tx_data["categorization_source"] == "USER_MANUAL"

    # Fetch detail
    detail_resp = client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == tx_id
    assert detail_resp.json()["normalized_merchant"] == "SWIGGY"


def test_transaction_update_safeguards_and_preference_save(client: TestClient):
    """15. Editing category flags USER_MANUAL and can save merchant preference."""
    headers = get_auth_headers(client, "intel_tx_update@campus.edu")

    # Create transaction
    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": 150.00,
            "category": "Transport",
            "merchant": "UBER",
            "description": "Ride to campus",
            "payment_method": "UPI",
        },
        headers=headers,
    )
    tx_id = create_resp.json()["id"]

    # Update category to 'Other' and set remember_merchant_preference = True
    update_resp = client.patch(
        f"/api/v1/transactions/{tx_id}",
        json={
            "category": "Other",
            "remember_merchant_preference": True,
        },
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["category"] == "Other"
    assert update_resp.json()["categorization_source"] == "USER_MANUAL"

    # Verify merchant preference was persisted
    pref_resp = client.get("/api/v1/merchant-preferences", headers=headers)
    assert pref_resp.status_code == 200
    prefs = pref_resp.json()
    assert any(p["normalized_merchant"] == "UBER" and p["category"] == "Other" for p in prefs)


# --------------------------------------------------------------------------
# 5. Bulk Category Update & Safety (16, 37)
# --------------------------------------------------------------------------

def test_bulk_category_update_and_ownership(client: TestClient):
    """16. Bulk category update applies to owned transactions only and validates categories."""
    headers_a = get_auth_headers(client, "intel_bulk_a@campus.edu")
    headers_b = get_auth_headers(client, "intel_bulk_b@campus.edu")

    # User A creates 2 transactions
    tx1 = client.post(
        "/api/v1/transactions",
        json={"transaction_type": "expense", "amount": 100.0, "category": "Food", "merchant": "SWIGGY", "payment_method": "UPI"},
        headers=headers_a,
    ).json()
    tx2 = client.post(
        "/api/v1/transactions",
        json={"transaction_type": "expense", "amount": 200.0, "category": "Food", "merchant": "SWIGGY", "payment_method": "UPI"},
        headers=headers_a,
    ).json()

    # User B creates 1 transaction
    tx_b = client.post(
        "/api/v1/transactions",
        json={"transaction_type": "expense", "amount": 300.0, "category": "Food", "merchant": "SWIGGY", "payment_method": "UPI"},
        headers=headers_b,
    ).json()

    # User A performs bulk update to 'Other' with remember preference
    bulk_resp = client.post(
        "/api/v1/transactions/bulk-category",
        json={
            "transaction_ids": [tx1["id"], tx2["id"], tx_b["id"]],
            "category": "Other",
            "update_merchant_preference": True,
        },
        headers=headers_a,
    )
    assert bulk_resp.status_code == 200
    res_data = bulk_resp.json()
    assert res_data["updated_count"] == 2  # Only user A's transactions were updated
    assert res_data["category"] == "Other"
    assert res_data["preference_saved"] is True

    # Verify User B's transaction category remains unchanged
    tx_b_current = client.get(f"/api/v1/transactions/{tx_b['id']}", headers=headers_b).json()
    assert tx_b_current["category"] == "Food"


# --------------------------------------------------------------------------
# 6. Advanced Search and Server-Side Filtering (17-22, 39, 40)
# --------------------------------------------------------------------------

def test_search_and_filtering_matrix(client: TestClient):
    """17-22, 39, 40. Server-side search by text, merchant, category, source, amount, and date."""
    headers = get_auth_headers(client, "intel_search@campus.edu")

    # Seed 3 distinct transactions
    client.post(
        "/api/v1/transactions",
        json={"transaction_type": "expense", "amount": 450.0, "category": "Food", "merchant": "DOMINOS", "payment_method": "UPI"},
        headers=headers,
    )
    client.post(
        "/api/v1/transactions",
        json={"transaction_type": "expense", "amount": 120.0, "category": "Transport", "merchant": "METRO RAIL", "payment_method": "Cash"},
        headers=headers,
    )
    client.post(
        "/api/v1/transactions",
        json={"transaction_type": "income", "amount": 5000.0, "category": "Scholarship", "merchant": "GOVT CELL", "payment_method": "Bank Transfer"},
        headers=headers,
    )

    # 1. Search by text "DOMINOS"
    s1 = client.get("/api/v1/transactions?search=dominos", headers=headers).json()
    assert s1["total"] == 1
    assert s1["items"][0]["normalized_merchant"] == "DOMINOS"

    # 2. Search by merchant filter
    s2 = client.get("/api/v1/transactions?merchant=METRO", headers=headers).json()
    assert s2["total"] == 1
    assert s2["items"][0]["category"] == "Transport"

    # 3. Filter by amount range (min_amount=400, max_amount=1000)
    s3 = client.get("/api/v1/transactions?min_amount=400&max_amount=1000", headers=headers).json()
    assert s3["total"] == 1
    assert float(s3["items"][0]["amount"]) == 450.0

    # 4. Filter by transaction type "income"
    s4 = client.get("/api/v1/transactions?transaction_type=income", headers=headers).json()
    assert s4["total"] == 1
    assert s4["items"][0]["category"] == "Scholarship"

    # 5. Empty search results
    s5 = client.get("/api/v1/transactions?search=NONEXISTENT_QUERY_XYZ", headers=headers).json()
    assert s5["total"] == 0
    assert len(s5["items"]) == 0

    # 6. Pagination check
    s6 = client.get("/api/v1/transactions?limit=1&offset=0", headers=headers).json()
    assert len(s6["items"]) == 1
    assert s6["total"] == 3


# --------------------------------------------------------------------------
# 7. Bank Sync, Duplicate Detection, & Reconciliation Integrity (13, 23-27)
# --------------------------------------------------------------------------

def test_bank_sync_normalization_and_duplicate_prevention(client: TestClient):
    """13, 23-27. Bank sync applies normalization, enforces duplicate protection, and respects auto-reconciliation."""
    headers = get_auth_headers(client, "intel_sync@campus.edu")

    # Connect mock bank account
    conn_resp = client.post("/api/v1/accounts/connect/mock", headers=headers)
    assert conn_resp.status_code == 201
    acc_id = conn_resp.json()["id"]

    # 1. Trigger bank sync
    sync_resp = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert sync_resp.status_code == 200
    sync_run = sync_resp.json()
    assert sync_run["transactions_imported"] > 0

    # Verify imported bank transactions have normalized merchants and high/medium confidence
    tx_list = client.get("/api/v1/transactions?source=BANK_SYNC", headers=headers).json()
    assert tx_list["total"] > 0
    first_tx = tx_list["items"][0]
    assert first_tx["normalized_merchant"] is not None
    assert first_tx["category_confidence"] in ("HIGH", "MEDIUM")
    assert first_tx["status"] == "POSTED"

    # 2. Repeated sync returns 0 imported (duplicate prevention intact)
    sync_again = client.post(f"/api/v1/accounts/{acc_id}/sync", headers=headers)
    assert sync_again.status_code == 200
    assert sync_again.json()["transactions_imported"] == 0
    assert sync_again.json()["transactions_skipped"] > 0


# --------------------------------------------------------------------------
# 8. Analytics & Financial Integrity After Categorization (28-31)
# --------------------------------------------------------------------------

def test_analytics_and_copilot_after_category_change(client: TestClient):
    """28-31. Changing transaction category immediately updates analytics, budgets, and Copilot context."""
    headers = get_auth_headers(client, "intel_analytics@campus.edu")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "intel_analytics@campus.edu").first()

        # 1. Create Food transaction of 500
        tx = client.post(
            "/api/v1/transactions",
            json={"transaction_type": "expense", "amount": 500.0, "category": "Food", "merchant": "SWIGGY", "payment_method": "UPI"},
            headers=headers,
        ).json()

        # Check analytics summary
        sum1 = client.get("/api/v1/analytics/summary", headers=headers).json()
        assert float(sum1["total_expenses"]) == 500.0

        # Check monthly category spending
        cat1 = client.get("/api/v1/analytics/categories", headers=headers).json()
        food_item = next(item for item in cat1["items"] if item["category"] == "Food")
        assert float(food_item["amount"]) == 500.0

        # 2. Change category from Food to Other
        client.patch(
            f"/api/v1/transactions/{tx['id']}",
            json={"category": "Other"},
            headers=headers,
        )

        # 3. Verify category spending reflects the change immediately
        cat2 = client.get("/api/v1/analytics/categories", headers=headers).json()
        assert not any(item["category"] == "Food" for item in cat2["items"])
        other_item = next(item for item in cat2["items"] if item["category"] == "Other")
        assert float(other_item["amount"]) == 500.0

        # 4. Verify AI Copilot Context Builder sees updated transaction and merchant intelligence
        now = datetime.datetime.now(datetime.timezone.utc)
        ctx = FinancialContextBuilder.build_context(db, user.id, now.year, now.month)
        assert len(ctx["recent_transactions"]) >= 1
        recent = ctx["recent_transactions"][0]
        assert recent["category"] == "Other"
        assert recent["merchant"] == "SWIGGY"
        assert any(m["merchant"] == "SWIGGY" for m in ctx["top_merchants"])
    finally:
        db.close()
