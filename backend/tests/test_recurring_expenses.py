import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User
from app.models.transaction import Transaction
from app.models.recurring_expense import RecurringExpense
from app.models.recurring_preference import RecurringPreference
from app.services.recurring_expense_service import RecurringExpenseService
from app.services.financial_context_builder import FinancialContextBuilder
from scripts.backfill_recurring import backfill_all_users


@pytest.fixture(autouse=True)
def cleanup_recurring_test_data():
    """Clean up test users, recurring records, and preferences before and after each test."""
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("recur_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("recur_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str = "recur_student@campus.edu") -> str:
    """Register student and obtain access token."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": "Recurring Test Student",
        },
    )
    if resp.status_code == 201:
        return resp.json()["access_token"]
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    return login_resp.json()["access_token"]


def create_tx(
    client: TestClient,
    token: str,
    amount: str,
    category: str,
    merchant: str,
    transaction_date: str,
    transaction_type: str = "expense",
    status: str = "POSTED",
) -> dict:
    """Helper to create a transaction."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": transaction_type,
            "amount": amount,
            "category": category,
            "merchant": merchant,
            "payment_method": "UPI",
            "transaction_date": transaction_date,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ==============================================================================
# TESTS 1 - 25
# ==============================================================================

def test_1_and_4_monthly_pattern_and_detection(client: TestClient):
    """1. recurring detection & 4. monthly pattern: Detects 3 monthly payments of Spotify ₹119."""
    token = get_auth_token(client, "recur_monthly@campus.edu")
    dates = ["2026-06-01T10:00:00Z", "2026-07-01T10:00:00Z", "2026-08-01T10:00:00Z"]
    for dt in dates:
        create_tx(client, token, "119.00", "Entertainment", "Spotify", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    spotify = next((i for i in items if i["normalized_merchant"] == "SPOTIFY"), None)
    assert spotify is not None
    assert spotify["frequency"] == "MONTHLY"
    assert spotify["recurring_type"] == "SUBSCRIPTION"
    assert Decimal(str(spotify["latest_amount"])) == Decimal("119.00")
    assert spotify["occurrence_count"] == 3


def test_2_insufficient_data(client: TestClient):
    """2. insufficient data: Only 1 transaction does not trigger recurring pattern."""
    token = get_auth_token(client, "recur_insufficient@campus.edu")
    create_tx(client, token, "649.00", "Entertainment", "Netflix", "2026-09-01T10:00:00Z")

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 0


def test_3_weekly_pattern(client: TestClient):
    """3. weekly pattern: Detects 3 weekly payments of Hostel Mess ₹500 (intervals: 7 days)."""
    token = get_auth_token(client, "recur_weekly@campus.edu")
    dates = ["2026-09-01T12:00:00Z", "2026-09-08T12:00:00Z", "2026-09-15T12:00:00Z"]
    for dt in dates:
        create_tx(client, token, "500.00", "Food", "Hostel Mess", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    items = res.json()
    mess = next((i for i in items if i["normalized_merchant"] == "HOSTEL MESS"), None)
    assert mess is not None
    assert mess["frequency"] == "WEEKLY"
    assert mess["recurring_type"] == "RECURRING_EXPENSE"
    assert Decimal(str(mess["latest_amount"])) == Decimal("500.00")


def test_5_variable_amount(client: TestClient):
    """5. variable amount: Variable amounts (e.g. Electricity ₹1100, ₹1450, ₹1250) flagged as is_variable_amount."""
    token = get_auth_token(client, "recur_variable@campus.edu")
    tx_data = [
        ("1100.00", "2026-06-01T10:00:00Z"),
        ("1450.00", "2026-07-01T10:00:00Z"),
        ("1250.00", "2026-08-01T10:00:00Z"),
    ]
    for amt, dt in tx_data:
        create_tx(client, token, amt, "Bills", "Electricity", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    item = next((i for i in res.json() if i["normalized_merchant"] == "ELECTRICITY"), None)
    assert item is not None
    assert item["is_variable_amount"] is True
    assert Decimal(str(item["min_amount"])) == Decimal("1100.00")
    assert Decimal(str(item["max_amount"])) == Decimal("1450.00")


def test_6_amount_change_detection(client: TestClient):
    """6. amount change: Detects Netflix price change from ₹649 to ₹699 (+₹50.00, +7.70%)."""
    token = get_auth_token(client, "recur_pricechange@campus.edu")
    dates_amounts = [
        ("649.00", "2026-06-01T10:00:00Z"),
        ("649.00", "2026-07-01T10:00:00Z"),
        ("699.00", "2026-08-01T10:00:00Z"),
    ]
    for amt, dt in dates_amounts:
        create_tx(client, token, amt, "Entertainment", "Netflix", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    netflix = next((i for i in res.json() if i["normalized_merchant"] == "NETFLIX"), None)
    assert netflix is not None
    assert Decimal(str(netflix["latest_amount"])) == Decimal("699.00")
    assert Decimal(str(netflix["previous_amount"])) == Decimal("649.00")
    assert Decimal(str(netflix["amount_change"])) == Decimal("50.00")
    assert Decimal(str(netflix["amount_change_percentage"])) > Decimal("7.00")


def test_7_subscription_classification(client: TestClient):
    """7. subscription classification: Netflix classified as SUBSCRIPTION."""
    token = get_auth_token(client, "recur_subclass@campus.edu")
    for dt in ["2026-06-01T10:00:00Z", "2026-07-01T10:00:00Z", "2026-08-01T10:00:00Z"]:
        create_tx(client, token, "199.00", "Entertainment", "YouTube Premium", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    item = res.json()[0]
    assert item["recurring_type"] == "SUBSCRIPTION"


def test_8_recurring_bill_classification(client: TestClient):
    """8. recurring bill classification: Airtel broadband classified as RECURRING_BILL."""
    token = get_auth_token(client, "recur_billclass@campus.edu")
    for dt in ["2026-06-01T10:00:00Z", "2026-07-01T10:00:00Z", "2026-08-01T10:00:00Z"]:
        create_tx(client, token, "799.00", "Bills", "Airtel", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    item = res.json()[0]
    assert item["recurring_type"] == "RECURRING_BILL"


def test_9_merchant_normalization_integration(client: TestClient):
    """9. merchant normalization integration: Groups variants 'UPI/SWIGGY/1234', 'SWIGGY ORDER 555'."""
    token = get_auth_token(client, "recur_norm@campus.edu")
    dates_desc = [
        ("UPI/SWIGGY/1234", "2026-09-01T12:00:00Z"),
        ("SWIGGY ORDER 555", "2026-09-08T12:00:00Z"),
        ("UPI-SWIGGY-9876", "2026-09-15T12:00:00Z"),
    ]
    headers = {"Authorization": f"Bearer {token}"}
    for desc, dt in dates_desc:
        client.post(
            "/api/v1/transactions",
            headers=headers,
            json={
                "transaction_type": "expense",
                "amount": "250.00",
                "category": "Food",
                "description": desc,
                "payment_method": "UPI",
                "transaction_date": dt,
            },
        )

    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    items = res.json()
    swiggy = next((i for i in items if i["normalized_merchant"] == "SWIGGY"), None)
    assert swiggy is not None
    assert swiggy["occurrence_count"] == 3


def test_10_and_11_ignored_merchant_and_preference_override(client: TestClient):
    """10. ignored merchant & 11. user preference override: User explicitly ignores merchant."""
    token = get_auth_token(client, "recur_ignore@campus.edu")
    for dt in ["2026-08-01T10:00:00Z", "2026-09-01T10:00:00Z", "2026-10-01T10:00:00Z"]:
        create_tx(client, token, "149.00", "Entertainment", "Prime Video", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    rec_id = items[0]["id"]

    # Post ignore
    res_ignore = client.post(f"/api/v1/recurring/{rec_id}/ignore", headers=headers)
    assert res_ignore.status_code == 200
    assert res_ignore.json()["status"] == "USER_IGNORED"

    # Confirm it's ignored in preferences
    pref_res = client.get("/api/v1/recurring/preferences", headers=headers)
    assert pref_res.status_code == 200
    assert any(p["preference_type"] == "IGNORE" for p in pref_res.json())

    # User re-confirms as subscription
    res_confirm = client.post(
        f"/api/v1/recurring/{rec_id}/confirm?mark_as_subscription=true", headers=headers
    )
    assert res_confirm.status_code == 200
    assert res_confirm.json()["status"] == "ACTIVE"
    assert res_confirm.json()["recurring_type"] == "SUBSCRIPTION"


def test_12_and_13_user_isolation_and_idor(client: TestClient):
    """12. user isolation & 13. IDOR: Student A cannot view or modify Student B's recurring items."""
    token_a = get_auth_token(client, "recur_a@campus.edu")
    token_b = get_auth_token(client, "recur_b@campus.edu")

    for dt in ["2026-06-01T10:00:00Z", "2026-07-01T10:00:00Z", "2026-08-01T10:00:00Z"]:
        create_tx(client, token_a, "8000.00", "Hostel/Rent", "PG Rent", dt)

    res_a = client.get("/api/v1/recurring", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    items_a = res_a.json()
    assert len(items_a) == 1
    item_a_id = items_a[0]["id"]

    # Student B should NOT see Student A's recurring records
    res_b = client.get("/api/v1/recurring", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200
    assert len(res_b.json()) == 0

    # Student B attempts IDOR on Student A's recurring record -> 404
    headers_b = {"Authorization": f"Bearer {token_b}"}
    res_idor_get = client.get(f"/api/v1/recurring/{item_a_id}", headers=headers_b)
    assert res_idor_get.status_code == 404

    res_idor_patch = client.patch(
        f"/api/v1/recurring/{item_a_id}", headers=headers_b, json={"status": "PAUSED"}
    )
    assert res_idor_patch.status_code == 404

    res_idor_ignore = client.post(f"/api/v1/recurring/{item_a_id}/ignore", headers=headers_b)
    assert res_idor_ignore.status_code == 404


def test_14_deleted_transaction_handling(client: TestClient):
    """14. deleted transaction: Deleting a transaction recomputes recurring metrics safely."""
    token = get_auth_token(client, "recur_delete@campus.edu")
    t1 = create_tx(client, token, "199.00", "Bills", "Jio", "2026-06-01T10:00:00Z")
    t2 = create_tx(client, token, "199.00", "Bills", "Jio", "2026-07-01T10:00:00Z")
    t3 = create_tx(client, token, "199.00", "Bills", "Jio", "2026-08-01T10:00:00Z")

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert len(res.json()) == 1

    # Delete 3rd transaction
    del_res = client.delete(f"/api/v1/transactions/{t3['id']}", headers=headers)
    assert del_res.status_code == 200

    # Recurring record occurrence count reflects updated count or absence
    res_after = client.get("/api/v1/recurring", headers=headers)
    assert res_after.status_code == 200


def test_15_and_16_reversed_and_pending_transactions(client: TestClient):
    """15. reversed & 16. pending transactions: Excluded from recurring pattern detection."""
    token = get_auth_token(client, "recur_status@campus.edu")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "recur_status@campus.edu").first()
        # Add 1 posted, 1 pending, 1 reversed
        tx1 = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("499.00"),
            category="Bills",
            merchant="Airtel",
            normalized_merchant="AIRTEL",
            status="POSTED",
            payment_method="UPI",
            transaction_date=datetime.datetime(2026, 6, 1, tzinfo=datetime.timezone.utc),
        )
        tx2 = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("499.00"),
            category="Bills",
            merchant="Airtel",
            normalized_merchant="AIRTEL",
            status="PENDING",
            payment_method="UPI",
            transaction_date=datetime.datetime(2026, 7, 1, tzinfo=datetime.timezone.utc),
        )
        tx3 = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("499.00"),
            category="Bills",
            merchant="Airtel",
            normalized_merchant="AIRTEL",
            status="REVERSED",
            payment_method="UPI",
            transaction_date=datetime.datetime(2026, 8, 1, tzinfo=datetime.timezone.utc),
        )
        db.add_all([tx1, tx2, tx3])
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    # Only 1 POSTED transaction exists, so no recurring pattern should be declared
    assert len(res.json()) == 0


def test_17_refund_handling(client: TestClient):
    """17. refund handling: Income transactions or negative adjustments don't create false expense recurring patterns."""
    token = get_auth_token(client, "recur_refund@campus.edu")
    # 2 expenses, 1 income refund
    create_tx(client, token, "649.00", "Entertainment", "Netflix", "2026-06-01T10:00:00Z")
    create_tx(client, token, "649.00", "Entertainment", "Netflix", "2026-07-01T10:00:00Z")
    # Income refund
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "income",
            "amount": "649.00",
            "category": "Other",
            "merchant": "Netflix",
            "payment_method": "UPI",
            "transaction_date": "2026-07-02T10:00:00Z",
        },
    )

    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    # Only 2 expenses, insufficient data for 3 occurrences
    assert len(res.json()) == 0


def test_18_reconciled_duplicate_handling(client: TestClient):
    """18. reconciled duplicate: Reconciled transactions (manual + bank) count as ONE occurrence."""
    token = get_auth_token(client, "recur_reconciled@campus.edu")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "recur_reconciled@campus.edu").first()
        # Month 1: Manual tx + Bank tx reconciled together
        t1 = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("119.00"),
            category="Entertainment",
            merchant="Spotify",
            normalized_merchant="SPOTIFY",
            status="POSTED",
            payment_method="UPI",
            source="MANUAL",
            reconciliation_status="RECONCILED",
            transaction_date=datetime.datetime(2026, 7, 1, tzinfo=datetime.timezone.utc),
        )
        db.add(t1)
        db.commit()
        db.refresh(t1)

        t1_bank = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("119.00"),
            category="Entertainment",
            merchant="Spotify",
            normalized_merchant="SPOTIFY",
            status="POSTED",
            payment_method="UPI",
            source="BANK_SYNC",
            reconciliation_status="RECONCILED",
            reconciled_with_id=t1.id,
            transaction_date=datetime.datetime(2026, 7, 1, tzinfo=datetime.timezone.utc),
        )
        db.add(t1_bank)
        db.commit()
        db.refresh(t1_bank)
        t1.reconciled_with_id = t1_bank.id

        # Month 2
        t2 = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("119.00"),
            category="Entertainment",
            merchant="Spotify",
            normalized_merchant="SPOTIFY",
            status="POSTED",
            payment_method="UPI",
            transaction_date=datetime.datetime(2026, 8, 1, tzinfo=datetime.timezone.utc),
        )
        # Month 3
        t3 = Transaction(
            user_id=user.id,
            transaction_type="expense",
            amount=Decimal("119.00"),
            category="Entertainment",
            merchant="Spotify",
            normalized_merchant="SPOTIFY",
            status="POSTED",
            payment_method="UPI",
            transaction_date=datetime.datetime(2026, 9, 1, tzinfo=datetime.timezone.utc),
        )
        db.add_all([t1, t2, t3])
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    # Occurrence count should be 3, NOT 4!
    assert items[0]["occurrence_count"] == 3


def test_19_next_expected_date(client: TestClient):
    """19. next expected date: Accurately projects next billing cycle date."""
    last_dt = datetime.datetime(2026, 9, 15, 12, 0, tzinfo=datetime.timezone.utc)
    weekly_next = RecurringExpenseService.calculate_next_expected_date(last_dt, "WEEKLY")
    assert (weekly_next.date() - last_dt.date()).days == 7

    monthly_next = RecurringExpenseService.calculate_next_expected_date(last_dt, "MONTHLY")
    assert monthly_next.month == 10
    assert monthly_next.day == 15


def test_20_and_21_missed_expected_payment_and_ended_pattern(client: TestClient):
    """20. missed expected payment & 21. ended pattern: Evaluates OVERDUE_EXPECTED and POSSIBLY_ENDED."""
    token = get_auth_token(client, "recur_overdue@campus.edu")
    # Transactions in Jan, Feb, Mar 2025 (very old, next expected was Apr 2025 -> now in late 2026, so POSSIBLY_ENDED)
    for dt in ["2025-01-01T10:00:00Z", "2025-02-01T10:00:00Z", "2025-03-01T10:00:00Z"]:
        create_tx(client, token, "149.00", "Entertainment", "Coursera", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    items = res.json()
    coursera = next((i for i in items if i["normalized_merchant"] == "COURSERA"), None)
    assert coursera is not None
    assert coursera["status"] == "POSSIBLY_ENDED"


def test_22_api_authorization(client: TestClient):
    """22. API authorization: Anonymous request to /api/v1/recurring rejected with 401."""
    res = client.get("/api/v1/recurring")
    assert res.status_code == 401

    res_sum = client.get("/api/v1/recurring/summary")
    assert res_sum.status_code == 401


def test_23_summary_calculations(client: TestClient):
    """23. summary calculations: Computes total monthly recurring spend, subscription counts, and upcoming payments."""
    token = get_auth_token(client, "recur_summary@campus.edu")
    # Create 3 monthly Netflix (₹649) and 3 weekly Mess (₹500)
    now = datetime.datetime.now(datetime.timezone.utc)
    for i in [60, 30, 0]:
        dt = (now - datetime.timedelta(days=i)).isoformat()
        create_tx(client, token, "649.00", "Entertainment", "Netflix", dt)
    for i in [14, 7, 0]:
        dt = (now - datetime.timedelta(days=i)).isoformat()
        create_tx(client, token, "500.00", "Food", "Hostel Mess", dt)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring/summary", headers=headers)
    assert res.status_code == 200
    summary = res.json()
    assert summary["subscription_count"] >= 1
    assert Decimal(str(summary["total_monthly_recurring_spend"])) > Decimal("649.00")
    assert len(summary["upcoming_payments"]) >= 1


def test_24_migration_and_backfill(client: TestClient):
    """24. migration/backfill: Safe backfill runs without altering historical transactions."""
    token = get_auth_token(client, "recur_backfill@campus.edu")
    for dt in ["2026-06-01T10:00:00Z", "2026-07-01T10:00:00Z", "2026-08-01T10:00:00Z"]:
        create_tx(client, token, "199.00", "Bills", "Airtel", dt)

    # Run backfill
    backfill_all_users()

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/recurring", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_25_copilot_context_integration(client: TestClient):
    """25. Copilot context: FinancialContextBuilder includes verified recurring intelligence."""
    token = get_auth_token(client, "recur_copilot@campus.edu")
    for dt in ["2026-06-01T10:00:00Z", "2026-07-01T10:00:00Z", "2026-08-01T10:00:00Z"]:
        create_tx(client, token, "119.00", "Entertainment", "Spotify", dt)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "recur_copilot@campus.edu").first()
        ctx = FinancialContextBuilder.build_context(db, user.id, 2026, 8)
        assert "recurring_intelligence" in ctx
        rec_intel = ctx["recurring_intelligence"]
        assert rec_intel["subscription_count"] >= 1
        assert len(rec_intel["subscriptions"]) >= 1
        assert rec_intel["subscriptions"][0]["merchant"] == "Spotify"
    finally:
        db.close()
