import calendar
import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.account import ConnectedAccount
from app.models.budget import Budget
from app.models.financial_profile import FinancialProfile
from app.models.forecast_preference import ForecastPreference
from app.models.goal import Goal
from app.models.recurring_expense import RecurringExpense
from app.models.transaction import Transaction
from app.models.user import User
from app.services.cash_flow_forecast_service import CashFlowForecastService
from app.services.financial_context_builder import FinancialContextBuilder
from app.services.ai_provider import MockAIProvider


@pytest.fixture(autouse=True)
def cleanup_forecast_test_data():
    """Clean up test users and associated data before and after each test."""
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("fc_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("fc_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str = "fc_student@campus.edu") -> str:
    """Register student and obtain access token."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": "Forecast Test Student",
        },
    )
    if resp.status_code == 201:
        return resp.json()["access_token"]
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    return login_resp.json()["access_token"]


def get_user_id(email: str = "fc_student@campus.edu") -> int:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        return user.id
    finally:
        db.close()


# ------------------------------------------------------------------------------
# 1. No data scenario
# ------------------------------------------------------------------------------
def test_no_data_scenario(client: TestClient):
    token = get_auth_token(client, "fc_nodata@campus.edu")
    resp = client.get("/api/v1/forecast", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_sufficiency"] == "INSUFFICIENT"
    assert data["confidence"] == "LOW"
    assert Decimal(data["expected_income"]) == Decimal("0.00")
    assert Decimal(data["expected_recurring_expenses"]) == Decimal("0.00")
    assert Decimal(data["estimated_discretionary_spending"]) == Decimal("0.00")
    assert Decimal(data["current_ledger_balance"]) == Decimal("0.00")
    assert Decimal(data["projected_balance"]) == Decimal("0.00")


# ------------------------------------------------------------------------------
# 2. Insufficient data
# ------------------------------------------------------------------------------
def test_insufficient_data(client: TestClient):
    token = get_auth_token(client, "fc_insufficient@campus.edu")
    u_id = get_user_id("fc_insufficient@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        t1 = Transaction(
            user_id=u_id,
            transaction_type="income",
            amount=Decimal("5000.00"),
            category="Salary",
            payment_method="Bank Transfer",
            transaction_date=now - datetime.timedelta(days=2),
            status="POSTED",
            source="MANUAL",
        )
        t2 = Transaction(
            user_id=u_id,
            transaction_type="expense",
            amount=Decimal("300.00"),
            category="Food",
            payment_method="UPI",
            transaction_date=now - datetime.timedelta(days=1),
            status="POSTED",
            source="MANUAL",
        )
        db.add_all([t1, t2])
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_sufficiency"] == "INSUFFICIENT"
    assert Decimal(data["current_ledger_balance"]) == Decimal("4700.00")
    assert Decimal(data["estimated_discretionary_spending"]) == Decimal("0.00")


# ------------------------------------------------------------------------------
# 3. Limited data
# ------------------------------------------------------------------------------
def test_limited_data(client: TestClient):
    token = get_auth_token(client, "fc_limited@campus.edu")
    u_id = get_user_id("fc_limited@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        txs = []
        for i in range(8):
            txs.append(
                Transaction(
                    user_id=u_id,
                    transaction_type="expense",
                    amount=Decimal("150.00"),
                    category="Food",
                    payment_method="UPI",
                    transaction_date=now - datetime.timedelta(days=i * 2 + 1),
                    status="POSTED",
                    source="MANUAL",
                )
            )
        db.add_all(txs)
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_sufficiency"] == "LIMITED"
    assert Decimal(data["estimated_discretionary_spending"]) > Decimal("0.00")


# ------------------------------------------------------------------------------
# 4. Strong data
# ------------------------------------------------------------------------------
def test_strong_data(client: TestClient):
    token = get_auth_token(client, "fc_strong@campus.edu")
    u_id = get_user_id("fc_strong@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        txs = []
        for i in range(50):
            txs.append(
                Transaction(
                    user_id=u_id,
                    transaction_type="expense",
                    amount=Decimal("100.00"),
                    category="Food",
                    payment_method="UPI",
                    transaction_date=now - datetime.timedelta(days=i + 1),
                    status="POSTED",
                    source="MANUAL",
                )
            )
        db.add_all(txs)
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_sufficiency"] == "STRONG"
    assert data["confidence"] == "HIGH"


# ------------------------------------------------------------------------------
# 5. Recurring income prediction
# ------------------------------------------------------------------------------
def test_recurring_income_prediction(client: TestClient):
    token = get_auth_token(client, "fc_income@campus.edu")
    u_id = get_user_id("fc_income@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # 3 regular monthly stipends: 60 days ago, 30 days ago, today
        t1 = Transaction(
            user_id=u_id,
            transaction_type="income",
            amount=Decimal("10000.00"),
            category="Stipend",
            merchant="Campus Lab",
            normalized_merchant="CAMPUS LAB",
            payment_method="Bank Transfer",
            transaction_date=now - datetime.timedelta(days=60),
            status="POSTED",
            source="MANUAL",
        )
        t2 = Transaction(
            user_id=u_id,
            transaction_type="income",
            amount=Decimal("10000.00"),
            category="Stipend",
            merchant="Campus Lab",
            normalized_merchant="CAMPUS LAB",
            payment_method="Bank Transfer",
            transaction_date=now - datetime.timedelta(days=30),
            status="POSTED",
            source="MANUAL",
        )
        db.add_all([t1, t2])
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["expected_income"]) >= Decimal("10000.00")
    inc_events = [ev for ev in data["timeline"] if ev["type"] == "EXPECTED_INCOME"]
    assert len(inc_events) >= 1
    assert "Campus Lab" in inc_events[0]["name"]


# ------------------------------------------------------------------------------
# 6, 7, 8. Recurring expenses, subscriptions, and recurring bills
# ------------------------------------------------------------------------------
def test_recurring_expenses_subscriptions_bills(client: TestClient):
    token = get_auth_token(client, "fc_recurring@campus.edu")
    u_id = get_user_id("fc_recurring@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        sub = RecurringExpense(
            user_id=u_id,
            merchant="Netflix",
            normalized_merchant="NETFLIX",
            category="Entertainment",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("649.00"),
            latest_amount=Decimal("649.00"),
            min_amount=Decimal("649.00"),
            max_amount=Decimal("649.00"),
            occurrence_count=4,
            last_occurrence_date=now - datetime.timedelta(days=20),
            next_expected_date=now + datetime.timedelta(days=10),
        )
        bill = RecurringExpense(
            user_id=u_id,
            merchant="Airtel Broadband",
            normalized_merchant="AIRTEL BROADBAND",
            category="Bills",
            recurring_type="RECURRING_BILL",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("999.00"),
            latest_amount=Decimal("999.00"),
            min_amount=Decimal("999.00"),
            max_amount=Decimal("999.00"),
            occurrence_count=3,
            last_occurrence_date=now - datetime.timedelta(days=25),
            next_expected_date=now + datetime.timedelta(days=5),
        )
        exp = RecurringExpense(
            user_id=u_id,
            merchant="Hostel Mess",
            normalized_merchant="HOSTEL MESS",
            category="Hostel/Rent",
            recurring_type="RECURRING_EXPENSE",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("3500.00"),
            latest_amount=Decimal("3500.00"),
            min_amount=Decimal("3500.00"),
            max_amount=Decimal("3500.00"),
            occurrence_count=3,
            last_occurrence_date=now - datetime.timedelta(days=15),
            next_expected_date=now + datetime.timedelta(days=15),
        )
        db.add_all([sub, bill, exp])
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["expected_recurring_expenses"]) == Decimal("5148.00")
    types = {ev["type"] for ev in data["timeline"]}
    assert "RECURRING_SUBSCRIPTION" in types
    assert "RECURRING_BILL" in types
    assert "RECURRING_EXPENSE" in types


# ------------------------------------------------------------------------------
# 9, 10. Discretionary spending & Projected balance math
# ------------------------------------------------------------------------------
def test_projected_balance_calculation(client: TestClient):
    token = get_auth_token(client, "fc_calc@campus.edu")
    u_id = get_user_id("fc_calc@campus.edu")
    db = SessionLocal()
    try:
        prof = FinancialProfile(user_id=u_id, starting_balance=Decimal("15000.00"))
        db.add(prof)

        now = datetime.datetime.now(datetime.timezone.utc)
        # Create non-recurring historical expenses
        txs = []
        for i in range(20):
            txs.append(
                Transaction(
                    user_id=u_id,
                    transaction_type="expense",
                    amount=Decimal("100.00"),
                    category="Food",
                    payment_method="UPI",
                    transaction_date=now - datetime.timedelta(days=i * 2 + 1),
                    status="POSTED",
                    source="MANUAL",
                )
            )
        db.add_all(txs)
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    # Ledger balance = 15000 - 2000 = 13000
    assert Decimal(data["current_ledger_balance"]) == Decimal("13000.00")
    # Projected balance should be starting balance - total outflow + income
    expected_proj = (
        Decimal(data["starting_balance"])
        + Decimal(data["expected_income"])
        - Decimal(data["projected_total_outflow"])
    )
    assert abs(Decimal(data["projected_balance"]) - expected_proj) < Decimal("0.05")


# ------------------------------------------------------------------------------
# 11. Negative forecast warning
# ------------------------------------------------------------------------------
def test_negative_forecast_and_warning(client: TestClient):
    token = get_auth_token(client, "fc_neg@campus.edu")
    u_id = get_user_id("fc_neg@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Starting balance ₹1,000, but upcoming rent ₹5,000 in 5 days
        prof = FinancialProfile(user_id=u_id, starting_balance=Decimal("1000.00"))
        rent = RecurringExpense(
            user_id=u_id,
            merchant="PG Rent",
            normalized_merchant="PG RENT",
            category="Hostel/Rent",
            recurring_type="RECURRING_EXPENSE",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("5000.00"),
            latest_amount=Decimal("5000.00"),
            min_amount=Decimal("5000.00"),
            max_amount=Decimal("5000.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=25),
            next_expected_date=now + datetime.timedelta(days=5),
        )
        db.add_all([prof, rent])
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_negative_projected"] is True
    assert data["negative_balance_date"] is not None
    assert any("becomes negative" in w for w in data["warnings"])


# ------------------------------------------------------------------------------
# 12, 13. Low balance detection & Preference threshold customization
# ------------------------------------------------------------------------------
def test_low_balance_detection_and_threshold_customization(client: TestClient):
    token = get_auth_token(client, "fc_threshold@campus.edu")
    u_id = get_user_id("fc_threshold@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        prof = FinancialProfile(user_id=u_id, starting_balance=Decimal("3000.00"))
        gym = RecurringExpense(
            user_id=u_id,
            merchant="Gym Fitness",
            normalized_merchant="GYM FITNESS",
            category="Health",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("1500.00"),
            latest_amount=Decimal("1500.00"),
            min_amount=Decimal("1500.00"),
            max_amount=Decimal("1500.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=25),
            next_expected_date=now + datetime.timedelta(days=7),
        )
        db.add_all([prof, gym])
        db.commit()
    finally:
        db.close()

    # Default threshold is ₹2,000. Balance goes from ₹3,000 to ₹1,500 (< ₹2,000)
    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_low_balance_projected"] is True
    assert data["low_balance_date"] is not None

    # Update threshold to ₹1,000 via PATCH /preference
    patch_resp = client.patch(
        "/api/v1/forecast/preference",
        json={"minimum_balance_threshold": 1000.00},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200
    assert Decimal(patch_resp.json()["minimum_balance_threshold"]) == Decimal("1000.00")

    # Now balance ₹1,500 >= ₹1,000, so it should not be low balance
    resp2 = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 200
    assert resp2.json()["is_low_balance_projected"] is False


# ------------------------------------------------------------------------------
# 14, 15, 16. Horizons: 7, 30, 90 days
# ------------------------------------------------------------------------------
def test_forecast_horizons_switching(client: TestClient):
    token = get_auth_token(client, "fc_horizons@campus.edu")
    u_id = get_user_id("fc_horizons@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Event in 10 days
        rec1 = RecurringExpense(
            user_id=u_id,
            merchant="Coursera",
            normalized_merchant="COURSERA",
            category="Education",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("1200.00"),
            latest_amount=Decimal("1200.00"),
            min_amount=Decimal("1200.00"),
            max_amount=Decimal("1200.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=20),
            next_expected_date=now + datetime.timedelta(days=10),
        )
        db.add(rec1)
        db.commit()
    finally:
        db.close()

    # 7-day forecast: event is in 10 days, so 0 commitments in 7 days
    r7 = client.get("/api/v1/forecast?days=7", headers={"Authorization": f"Bearer {token}"})
    assert r7.status_code == 200
    assert r7.json()["forecast_days"] == 7
    assert Decimal(r7.json()["expected_recurring_expenses"]) == Decimal("0.00")

    # 30-day forecast: includes event in 10 days
    r30 = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert r30.status_code == 200
    assert r30.json()["forecast_days"] == 30
    assert Decimal(r30.json()["expected_recurring_expenses"]) == Decimal("1200.00")

    # 90-day forecast: projects multiple monthly occurrences (days 10, 40, 70)
    r90 = client.get("/api/v1/forecast?days=90", headers={"Authorization": f"Bearer {token}"})
    assert r90.status_code == 200
    assert r90.json()["forecast_days"] == 90
    assert Decimal(r90.json()["expected_recurring_expenses"]) >= Decimal("3600.00")


# ------------------------------------------------------------------------------
# 17, 18, 19, 20. Boundaries: Month, Year, February, and Decimal precision
# ------------------------------------------------------------------------------
def test_boundaries_february_and_decimal_precision(client: TestClient):
    token = get_auth_token(client, "fc_boundaries@campus.edu")
    u_id = get_user_id("fc_boundaries@campus.edu")
    db = SessionLocal()
    try:
        # Starting date Jan 31 in a leap year
        as_of = datetime.date(2024, 1, 31)
        rec = RecurringExpense(
            user_id=u_id,
            merchant="Cloud Storage",
            normalized_merchant="CLOUD STORAGE",
            category="Bills",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("199.99"),
            latest_amount=Decimal("199.99"),
            min_amount=Decimal("199.99"),
            max_amount=Decimal("199.99"),
            occurrence_count=3,
            last_occurrence_date=datetime.datetime(2023, 12, 31, 0, 0, 0, tzinfo=datetime.timezone.utc),
            next_expected_date=datetime.datetime(2024, 1, 31, 0, 0, 0, tzinfo=datetime.timezone.utc),
        )
        db.add(rec)
        db.commit()

        # Compute deterministic forecast directly specifying as_of_date
        res = CashFlowForecastService.compute_cash_flow_forecast(db, u_id, days=90, as_of_date=as_of)
        # Check event dates for February in leap year: should be Feb 29, 2024
        rec_events = [ev for ev in res.timeline if ev.type == "RECURRING_SUBSCRIPTION"]
        feb_events = [ev for ev in rec_events if ev.date.month == 2]
        assert len(feb_events) == 1
        assert feb_events[0].date == datetime.date(2024, 2, 29)
        # Decimal precision check
        assert res.projected_balance == res.projected_balance.quantize(Decimal("0.01"))
        assert feb_events[0].amount == Decimal("199.99")
    finally:
        db.close()


# ------------------------------------------------------------------------------
# 21, 22. Pending and reversed transactions
# ------------------------------------------------------------------------------
def test_pending_and_reversed_transactions_excluded(client: TestClient):
    token = get_auth_token(client, "fc_status@campus.edu")
    u_id = get_user_id("fc_status@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        t_posted = Transaction(
            user_id=u_id,
            transaction_type="income",
            amount=Decimal("2000.00"),
            category="Salary",
            payment_method="Bank Transfer",
            transaction_date=now - datetime.timedelta(days=2),
            status="POSTED",
            source="MANUAL",
        )
        t_pending = Transaction(
            user_id=u_id,
            transaction_type="income",
            amount=Decimal("50000.00"),
            category="Salary",
            payment_method="Bank Transfer",
            transaction_date=now - datetime.timedelta(days=1),
            status="PENDING",
            source="MANUAL",
        )
        t_reversed = Transaction(
            user_id=u_id,
            transaction_type="income",
            amount=Decimal("100000.00"),
            category="Salary",
            payment_method="Bank Transfer",
            transaction_date=now - datetime.timedelta(days=1),
            status="REVERSED",
            source="MANUAL",
        )
        db.add_all([t_posted, t_pending, t_reversed])
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    # Only POSTED transaction counts toward current ledger balance
    assert Decimal(data["current_ledger_balance"]) == Decimal("2000.00")


# ------------------------------------------------------------------------------
# 23. Ignored recurring expenses excluded
# ------------------------------------------------------------------------------
def test_ignored_recurring_expenses_excluded(client: TestClient):
    token = get_auth_token(client, "fc_ignored@campus.edu")
    u_id = get_user_id("fc_ignored@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        rec_ignored = RecurringExpense(
            user_id=u_id,
            merchant="Cancelled Service",
            normalized_merchant="CANCELLED SERVICE",
            category="Entertainment",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            status="USER_IGNORED",
            average_amount=Decimal("500.00"),
            latest_amount=Decimal("500.00"),
            min_amount=Decimal("500.00"),
            max_amount=Decimal("500.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=20),
            next_expected_date=now + datetime.timedelta(days=10),
        )
        rec_paused = RecurringExpense(
            user_id=u_id,
            merchant="Paused Gym",
            normalized_merchant="PAUSED GYM",
            category="Health",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            status="PAUSED",
            average_amount=Decimal("1000.00"),
            latest_amount=Decimal("1000.00"),
            min_amount=Decimal("1000.00"),
            max_amount=Decimal("1000.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=20),
            next_expected_date=now + datetime.timedelta(days=10),
        )
        db.add_all([rec_ignored, rec_paused])
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["expected_recurring_expenses"]) == Decimal("0.00")
    assert len(data["timeline"]) == 0


# ------------------------------------------------------------------------------
# 24, 25. Connected account balance & Stale bank data surfacing
# ------------------------------------------------------------------------------
def test_connected_bank_balance_and_stale_warning(client: TestClient):
    token = get_auth_token(client, "fc_bank@campus.edu")
    u_id = get_user_id("fc_bank@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Bank synced 3 days ago (stale > 48h)
        acc = ConnectedAccount(
            user_id=u_id,
            provider="mock_bank",
            provider_account_id="ba_12345",
            institution_name="State Bank",
            account_type="savings",
            masked_account_number="••••9876",
            currency="INR",
            current_balance=Decimal("25000.00"),
            balance_as_of=now - datetime.timedelta(days=3),
            status="ACTIVE",
            last_synced_at=now - datetime.timedelta(days=3),
        )
        db.add(acc)
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["current_connected_bank_balance"]) == Decimal("25000.00")
    assert "3 days ago" in data["bank_data_freshness"]


# ------------------------------------------------------------------------------
# 26, 27, 28. User isolation, IDOR protection, API authorization
# ------------------------------------------------------------------------------
def test_user_isolation_idor_and_auth(client: TestClient):
    # Unauthenticated -> 401
    unauth = client.get("/api/v1/forecast")
    assert unauth.status_code == 401

    token_a = get_auth_token(client, "fc_user_a@campus.edu")
    token_b = get_auth_token(client, "fc_user_b@campus.edu")
    u_id_a = get_user_id("fc_user_a@campus.edu")
    u_id_b = get_user_id("fc_user_b@campus.edu")

    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # User A has ₹10,000
        pa = FinancialProfile(user_id=u_id_a, starting_balance=Decimal("10000.00"))
        # User B has ₹2,000
        pb = FinancialProfile(user_id=u_id_b, starting_balance=Decimal("2000.00"))
        db.add_all([pa, pb])
        db.commit()
    finally:
        db.close()

    # User A sees 10,000; User B sees 2,000
    ra = client.get("/api/v1/forecast", headers={"Authorization": f"Bearer {token_a}"})
    assert Decimal(ra.json()["current_ledger_balance"]) == Decimal("10000.00")

    rb = client.get("/api/v1/forecast", headers={"Authorization": f"Bearer {token_b}"})
    assert Decimal(rb.json()["current_ledger_balance"]) == Decimal("2000.00")

    # User A updates preference to 4,500. User B's preference must remain unchanged
    patch_a = client.patch(
        "/api/v1/forecast/preference",
        json={"minimum_balance_threshold": 4500.00},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert patch_a.status_code == 200
    assert Decimal(patch_a.json()["minimum_balance_threshold"]) == Decimal("4500.00")

    pref_b = client.get("/api/v1/forecast/preference", headers={"Authorization": f"Bearer {token_b}"})
    assert pref_b.status_code == 200
    assert Decimal(pref_b.json()["minimum_balance_threshold"]) == Decimal("2000.00")


# ------------------------------------------------------------------------------
# 29, 30. Goal planning and Budget pressure integration
# ------------------------------------------------------------------------------
def test_goal_and_budget_planning_integration(client: TestClient):
    token = get_auth_token(client, "fc_planning@campus.edu")
    u_id = get_user_id("fc_planning@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        prof = FinancialProfile(user_id=u_id, starting_balance=Decimal("20000.00"))
        # Goal: ₹12,000 target, ₹6,000 saved, target date in 6 months
        goal = Goal(
            user_id=u_id,
            name="Laptop Fund",
            target_amount=Decimal("12000.00"),
            current_amount=Decimal("6000.00"),
            target_date=now.date() + datetime.timedelta(days=180),
        )
        # Budget for current month: Food ₹3,000
        budget = Budget(
            user_id=u_id,
            year=now.year,
            month=now.month,
            category="Food",
            amount=Decimal("3000.00"),
        )
        # Spent ₹1,500 on Food within current month
        tx = Transaction(
            user_id=u_id,
            transaction_type="expense",
            amount=Decimal("1500.00"),
            category="Food",
            payment_method="UPI",
            transaction_date=datetime.datetime(now.year, now.month, 1, 12, 0, 0, tzinfo=datetime.timezone.utc),
            status="POSTED",
            source="MANUAL",
        )
        db.add_all([prof, goal, budget, tx])
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/forecast?days=30", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["goal_planning"]) == 1
    gp = data["goal_planning"][0]
    assert gp["goal_name"] == "Laptop Fund"
    assert Decimal(gp["remaining_amount"]) == Decimal("6000.00")
    assert gp["is_affordable"] is True

    assert len(data["budget_pressure"]) == 1
    bp = data["budget_pressure"][0]
    assert bp["category"] == "Food"
    assert Decimal(bp["spent_amount"]) == Decimal("1500.00")
    assert Decimal(bp["allocated_amount"]) == Decimal("3000.00")


# ------------------------------------------------------------------------------
# 31, 32, 33. Timeline chronological order, Copilot context, Summary endpoints
# ------------------------------------------------------------------------------
def test_timeline_order_and_copilot_context(client: TestClient):
    token = get_auth_token(client, "fc_copilot@campus.edu")
    u_id = get_user_id("fc_copilot@campus.edu")
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        prof = FinancialProfile(user_id=u_id, starting_balance=Decimal("10000.00"))
        rec = RecurringExpense(
            user_id=u_id,
            merchant="Spotify",
            normalized_merchant="SPOTIFY",
            category="Entertainment",
            recurring_type="SUBSCRIPTION",
            frequency="MONTHLY",
            status="ACTIVE",
            average_amount=Decimal("119.00"),
            latest_amount=Decimal("119.00"),
            min_amount=Decimal("119.00"),
            max_amount=Decimal("119.00"),
            occurrence_count=2,
            last_occurrence_date=now - datetime.timedelta(days=25),
            next_expected_date=now + datetime.timedelta(days=5),
        )
        db.add_all([prof, rec])
        db.commit()

        # Test Copilot FinancialContextBuilder contains cash_flow_forecast
        ctx = FinancialContextBuilder.build_context(db, u_id, now.year, now.month)
        assert "cash_flow_forecast" in ctx
        assert ctx["cash_flow_forecast"]["forecast_horizon_days"] == 30
        assert Decimal(ctx["cash_flow_forecast"]["starting_balance"]) == Decimal("10000.00")

        # Test MockAIProvider answering forecast question when data is limited
        provider = MockAIProvider()
        import asyncio
        reply = asyncio.run(
            provider.generate_response(
                system_instruction="",
                user_prompt="How much money might I have at the end of this month?",
                conversation_history=[],
                financial_context=ctx,
            )
        )
        assert "estimated balance over the next 30 days is projected around" in reply
        assert "10000.00" in reply
    finally:
        db.close()

    # Test GET /api/v1/forecast/summary
    sum_resp = client.get("/api/v1/forecast/summary?days=30", headers={"Authorization": f"Bearer {token}"})
    assert sum_resp.status_code == 200
    assert "timeline" not in sum_resp.json()
    assert Decimal(sum_resp.json()["starting_balance"]) == Decimal("10000.00")

    # Test GET /api/v1/forecast/timeline
    time_resp = client.get("/api/v1/forecast/timeline?days=30", headers={"Authorization": f"Bearer {token}"})
    assert time_resp.status_code == 200
    assert "timeline" in time_resp.json()
    assert len(time_resp.json()["timeline"]) >= 1
