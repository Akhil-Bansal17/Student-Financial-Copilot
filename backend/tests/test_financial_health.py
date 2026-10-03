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
from app.schemas.financial_health import (
    CashBufferStatus,
    CashFlowStabilityStatus,
    BudgetHealthStatus,
    RecurringBurdenStatus,
    GoalHealthStatus,
    SpendingPatternStatus,
    ForecastRiskStatus,
    ActionPriority,
)
from app.services.financial_health_service import FinancialHealthService
from app.services.financial_context_builder import FinancialContextBuilder
from app.services.ai_copilot_service import AICopilotService


@pytest.fixture(autouse=True)
def cleanup_financial_health_test_data():
    """Clean up test users and associated data before and after each test."""
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("fh_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("fh_%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str = "fh_student@campus.edu") -> str:
    """Register student and obtain access token."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "full_name": "Health Test Student",
        },
    )
    if resp.status_code == 201:
        return resp.json()["access_token"]
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    return login_resp.json()["access_token"]


def get_user_id(email: str = "fh_student@campus.edu") -> int:
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        return u.id if u else None
    finally:
        db.close()


# ==============================================================================
# 1. HEALTH DIMENSIONS & SUFFICIENCY TESTS
# ==============================================================================

def test_financial_health_insufficient_data(client: TestClient):
    """Brand new student with 0 transactions should get INSUFFICIENT_DATA states gracefully."""
    token = get_auth_token(client, "fh_empty@campus.edu")
    user_id = get_user_id("fh_empty@campus.edu")

    resp = client.get(
        "/api/v1/financial-health",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["data_sufficiency"] == "INSUFFICIENT"
    assert data["overview"]["overall_status_label"] == "Building Assessment"
    assert data["dimensions"]["CASH_BUFFER"]["status"] == CashBufferStatus.INSUFFICIENT_DATA.value
    assert data["dimensions"]["BUDGET_HEALTH"]["status"] == BudgetHealthStatus.NO_ACTIVE_BUDGET.value
    assert data["dimensions"]["GOAL_HEALTH"]["status"] == GoalHealthStatus.NO_ACTIVE_GOALS.value
    assert data["dimensions"]["FORECAST_RISK"]["status"] == ForecastRiskStatus.INSUFFICIENT_DATA.value

    # Smart actions should include data collection prompt
    action_types = [a["type"] for a in data["actions"]]
    assert "DATA_COLLECTION" in action_types


def test_financial_health_healthy_buffer_and_positive_outlook(client: TestClient):
    """User with sufficient balance, positive income, no debt, and within-budget spending."""
    token = get_auth_token(client, "fh_healthy@campus.edu")
    user_id = get_user_id("fh_healthy@campus.edu")
    db = SessionLocal()

    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        # Starting balance
        prof = FinancialProfile(user_id=user_id, starting_balance=Decimal("25000.00"))
        db.add(prof)

        # 16 transactions spread over 35 days
        for i in range(16):
            t_date = now - datetime.timedelta(days=35 - (i * 2))
            is_income = (i % 5 == 0)
            t = Transaction(
                user_id=user_id,
                amount=Decimal("10000.00") if is_income else Decimal("500.00"),
                transaction_type="income" if is_income else "expense",
                category="Scholarship" if is_income else "Food & Dining",
                description="Test transaction",
                payment_method="UPI",
                transaction_date=t_date,
            )
            db.add(t)

        # Active budget
        b = Budget(user_id=user_id, year=now.year, month=now.month, category="Food & Dining", amount=Decimal("8000.00"))
        db.add(b)

        # Active goal
        g = Goal(
            user_id=user_id,
            name="Laptop Fund",
            target_amount=Decimal("20000.00"),
            current_amount=Decimal("15000.00"),
            target_date=(now + datetime.timedelta(days=90)).date(),
        )
        db.add(g)
        db.commit()
    finally:
        db.close()

    resp = client.get(
        "/api/v1/financial-health",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["data_sufficiency"] in ("MODERATE", "STRONG", "LIMITED")
    assert data["dimensions"]["CASH_BUFFER"]["status"] == CashBufferStatus.HEALTHY_BUFFER.value
    assert data["dimensions"]["CASH_BUFFER"]["is_positive"] is True
    assert data["dimensions"]["BUDGET_HEALTH"]["status"] == BudgetHealthStatus.ON_TRACK.value
    assert data["dimensions"]["GOAL_HEALTH"]["status"] == GoalHealthStatus.ON_TRACK.value
    assert data["dimensions"]["FORECAST_RISK"]["status"] == ForecastRiskStatus.LOW_RISK.value

    # Check positive signals
    assert len(data["positive_signals"]) >= 2
    sig_dimensions = [s["dimension"] for s in data["positive_signals"]]
    assert "CASH_BUFFER" in sig_dimensions or "FORECAST_RISK" in sig_dimensions


def test_financial_health_negative_forecast_and_budget_overrun(client: TestClient):
    """User with low balance, heavy upcoming recurring expenses, and overspent budget."""
    token = get_auth_token(client, "fh_risk@campus.edu")
    user_id = get_user_id("fh_risk@campus.edu")
    db = SessionLocal()

    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        prof = FinancialProfile(user_id=user_id, starting_balance=Decimal("2000.00"))
        db.add(prof)

        # Minimum balance threshold: 3000
        pref = ForecastPreference(user_id=user_id, minimum_balance_threshold=Decimal("3000.00"), is_enabled=True)
        db.add(pref)

        # 16 transactions: 8 in current month (8 * 300 = 2400 > 2000 budget), 8 historical for forecast
        for i in range(8):
            t = Transaction(
                user_id=user_id,
                amount=Decimal("300.00"),
                transaction_type="expense",
                category="Food & Dining",
                description="Daily food",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(hours=i * 2 + 1),
            )
            db.add(t)
        for i in range(8):
            t = Transaction(
                user_id=user_id,
                amount=Decimal("300.00"),
                transaction_type="expense",
                category="Food & Dining",
                description="Past food",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=15 + i),
            )
            db.add(t)

        # Budget of 2000 for Food, but spent 2400 in current month -> OVER_BUDGET
        b = Budget(user_id=user_id, year=now.year, month=now.month, category="Food & Dining", amount=Decimal("2000.00"))
        db.add(b)

        # Heavy active recurring expense: 5000 due in 5 days -> drops balance negative
        rec = RecurringExpense(
            user_id=user_id,
            merchant="Hostel Mess",
            normalized_merchant="HOSTEL MESS",
            category="Housing",
            frequency="MONTHLY",
            recurring_type="RECURRING_BILL",
            status="ACTIVE",
            latest_amount=Decimal("5000.00"),
            average_amount=Decimal("5000.00"),
            min_amount=Decimal("5000.00"),
            max_amount=Decimal("5000.00"),
            next_expected_date=now + datetime.timedelta(days=5),
            last_occurrence_date=now - datetime.timedelta(days=25),
            occurrence_count=3,
        )
        db.add(rec)
        db.commit()
    finally:
        db.close()

    resp = client.get(
        "/api/v1/financial-health",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["dimensions"]["CASH_BUFFER"]["status"] == CashBufferStatus.AT_RISK.value
    assert data["dimensions"]["CASH_BUFFER"]["is_attention_required"] is True
    assert data["dimensions"]["BUDGET_HEALTH"]["status"] == BudgetHealthStatus.OVER_BUDGET.value
    assert data["dimensions"]["BUDGET_HEALTH"]["is_attention_required"] is True
    assert data["dimensions"]["FORECAST_RISK"]["status"] == ForecastRiskStatus.HIGH_RISK.value

    # Actions must include CRITICAL forecast action and HIGH budget overrun action
    actions = data["actions"]
    assert len(actions) >= 2
    assert actions[0]["priority"] == ActionPriority.CRITICAL.value
    assert actions[0]["type"] == "FORECAST_NEGATIVE"

    priorities = [a["priority"] for a in actions]
    assert ActionPriority.HIGH.value in priorities


# ==============================================================================
# 2. SMART ACTIONS & PRIORITIZATION TESTS
# ==============================================================================

def test_smart_actions_prioritization_and_deduplication(client: TestClient):
    """Smart actions must be deterministically sorted (CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO) and deduplicated."""
    token = get_auth_token(client, "fh_actions@campus.edu")
    user_id = get_user_id("fh_actions@campus.edu")
    db = SessionLocal()

    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        prof = FinancialProfile(user_id=user_id, starting_balance=Decimal("5000.00"))
        db.add(prof)

        # Transactions
        for i in range(16):
            t = Transaction(
                user_id=user_id,
                amount=Decimal("400.00"),
                transaction_type="expense",
                category="Food",
                description="Food lunch",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=32 - i * 2),
            )
            db.add(t)

        # Overdue goal
        g = Goal(
            user_id=user_id,
            name="Textbooks",
            target_amount=Decimal("3000.00"),
            current_amount=Decimal("1000.00"),
            target_date=(now - datetime.timedelta(days=5)).date(),  # Overdue
        )
        db.add(g)

        # Recurring expense with price increase
        rec = RecurringExpense(
            user_id=user_id,
            merchant="Netflix Student",
            normalized_merchant="NETFLIX STUDENT",
            category="Subscriptions",
            frequency="MONTHLY",
            recurring_type="SUBSCRIPTION",
            status="ACTIVE",
            latest_amount=Decimal("699.00"),
            previous_amount=Decimal("499.00"),
            average_amount=Decimal("599.00"),
            min_amount=Decimal("499.00"),
            max_amount=Decimal("699.00"),
            amount_change=Decimal("200.00"),
            amount_change_percentage=Decimal("40.1"),
            next_expected_date=now + datetime.timedelta(days=10),
            last_occurrence_date=now - datetime.timedelta(days=20),
            occurrence_count=3,
        )
        db.add(rec)
        db.commit()
    finally:
        db.close()

    resp = client.get(
        "/api/v1/financial-health/actions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    actions = data["actions"]
    assert len(actions) > 0

    # Verify deterministic sorting by priority order
    priority_ranks = {"CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4, "INFO": 5}
    ranks = [priority_ranks[a["priority"]] for a in actions]
    assert ranks == sorted(ranks), f"Actions are not sorted by priority: {ranks}"

    # Verify deduplication: all action IDs must be unique
    action_ids = [a["id"] for a in actions]
    assert len(action_ids) == len(set(action_ids)), "Duplicate action IDs detected!"

    # Verify counts
    assert data["total_count"] == len(actions)
    assert "by_priority" in data
    assert data["by_priority"]["HIGH"] >= 1  # Overdue goal


# ==============================================================================
# 3. BANK FRESHNESS INTEGRATION TESTS
# ==============================================================================

def test_financial_health_bank_freshness_fresh_and_stale(client: TestClient):
    """Test bank freshness detection: fresh (<12h) vs stale (>=12h) bank sync."""
    token = get_auth_token(client, "fh_bank@campus.edu")
    user_id = get_user_id("fh_bank@campus.edu")
    db = SessionLocal()

    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        # Connected account synced 15 hours ago (stale)
        acc = ConnectedAccount(
            user_id=user_id,
            provider="mock_bank",
            provider_account_id="acc_stale_123",
            institution_name="Demo Campus Bank",
            account_type="SAVINGS",
            masked_account_number="****4455",
            current_balance=Decimal("12000.00"),
            status="ACTIVE",
            last_synced_at=now - datetime.timedelta(hours=15),
        )
        db.add(acc)
        db.commit()
    finally:
        db.close()

    resp = client.get(
        "/api/v1/financial-health",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    freshness = data["bank_freshness"]
    assert freshness["has_connected_bank"] is True
    assert freshness["connected_accounts_count"] == 1
    assert freshness["is_stale"] is True
    assert freshness["impacts_assessment"] is True
    assert freshness["sync_status"] == "DELAYED"

    # Actions should include BANK_SYNC_STALE
    action_types = [a["type"] for a in data["actions"]]
    assert "BANK_SYNC_STALE" in action_types

    # Now simulate fresh sync (30 mins ago)
    db = SessionLocal()
    try:
        acc_db = db.query(ConnectedAccount).filter(ConnectedAccount.user_id == user_id).first()
        acc_db.last_synced_at = now - datetime.timedelta(minutes=30)
        db.commit()
    finally:
        db.close()

    resp2 = client.get(
        "/api/v1/financial-health",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 200
    freshness2 = resp2.json()["bank_freshness"]
    assert freshness2["is_stale"] is False
    assert freshness2["impacts_assessment"] is False
    assert freshness2["sync_status"] == "SUCCESS"


# ==============================================================================
# 4. SECURITY & TENANT ISOLATION TESTS
# ==============================================================================

def test_financial_health_unauthenticated_request_rejected(client: TestClient):
    """Unauthenticated requests must be rejected with 401."""
    resp = client.get("/api/v1/financial-health")
    assert resp.status_code == 401

    resp_actions = client.get("/api/v1/financial-health/actions")
    assert resp_actions.status_code == 401


def test_financial_health_strict_tenant_isolation(client: TestClient):
    """User A cannot see User B's financial health assessment, actions, or metrics."""
    token_a = get_auth_token(client, "fh_user_a@campus.edu")
    user_a_id = get_user_id("fh_user_a@campus.edu")

    token_b = get_auth_token(client, "fh_user_b@campus.edu")
    user_b_id = get_user_id("fh_user_b@campus.edu")

    db = SessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        # User A has 50,000 balance and Laptop goal
        db.add(FinancialProfile(user_id=user_a_id, starting_balance=Decimal("50000.00")))
        db.add(Goal(user_id=user_a_id, name="Secret Laptop A", target_amount=Decimal("35000.00"), current_amount=Decimal("20000.00")))
        db.add(Transaction(user_id=user_a_id, amount=Decimal("1500.00"), transaction_type="expense", category="SecretA", description="Tx A", payment_method="UPI", transaction_date=now))

        # User B has 700 balance and Tuition goal
        db.add(FinancialProfile(user_id=user_b_id, starting_balance=Decimal("700.00")))
        db.add(Goal(user_id=user_b_id, name="Tuition B", target_amount=Decimal("12345.00"), current_amount=Decimal("100.00")))
        db.add(Transaction(user_id=user_b_id, amount=Decimal("250.00"), transaction_type="expense", category="SecretB", description="Tx B", payment_method="UPI", transaction_date=now))
        db.commit()
    finally:
        db.close()

    resp_a = client.get("/api/v1/financial-health", headers={"Authorization": f"Bearer {token_a}"})
    assert resp_a.status_code == 200
    data_a = resp_a.json()

    resp_b = client.get("/api/v1/financial-health", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_b.status_code == 200
    data_b = resp_b.json()

    # Verify User A sees ONLY User A data
    assert data_a["dimensions"]["CASH_BUFFER"]["supporting_data"]["current_ledger_balance"] == "48500.00"
    assert data_a["dimensions"]["GOAL_HEALTH"]["supporting_data"]["total_target_amount"] == "35000.00"
    assert "35000.00" in str(data_a)
    assert "35000.00" not in str(data_b)
    assert "48500.00" in str(data_a)
    assert "48500.00" not in str(data_b)
    assert "12345.00" not in str(data_a)
    assert "450.00" not in str(data_a)

    # Verify User B sees ONLY User B data
    assert data_b["dimensions"]["CASH_BUFFER"]["supporting_data"]["current_ledger_balance"] == "450.00"
    assert data_b["dimensions"]["GOAL_HEALTH"]["supporting_data"]["total_target_amount"] == "12345.00"
    assert "12345.00" in str(data_b)
    assert "12345.00" not in str(data_a)
    assert "450.00" in str(data_b)
    assert "450.00" not in str(data_a)
    assert "48500.00" not in str(data_b)
    assert "35000.00" not in str(data_b)


def test_copilot_financial_health_and_smart_actions_responses(client: TestClient):
    """Copilot must explain verified financial health and recommend smart actions without hallucinating."""
    token = get_auth_token(client, "fh_copilot@campus.edu")
    user_id = get_user_id("fh_copilot@campus.edu")
    db = SessionLocal()

    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        db.add(FinancialProfile(user_id=user_id, starting_balance=Decimal("15000.00")))
        for i in range(16):
            t = Transaction(
                user_id=user_id,
                amount=Decimal("400.00"),
                transaction_type="expense",
                category="Food & Dining",
                description="Student meal",
                payment_method="UPI",
                transaction_date=now - datetime.timedelta(days=30 - i * 2),
            )
            db.add(t)
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Ask: "How am I doing financially?"
    resp1 = client.post("/api/v1/ai/copilot", headers=headers, json={"message": "How am I doing financially?"})
    assert resp1.status_code == 200
    ans1 = resp1.json()["answer"].lower()
    assert "financial health" in ans1 or "cash buffer" in ans1 or "summary" in ans1 or "balance" in ans1

    # 2. Ask: "What should I focus on?"
    resp2 = client.post("/api/v1/ai/copilot", headers=headers, json={"message": "What should I focus on right now?"})
    assert resp2.status_code == 200
    ans2 = resp2.json()["answer"].lower()
    assert "attention" in ans2 or "track" in ans2 or "next step" in ans2

    # 3. Ask: "Am I going to run out of money?"
    resp3 = client.post("/api/v1/ai/copilot", headers=headers, json={"message": "Am I going to run out of money this month?"})
    assert resp3.status_code == 200
    ans3 = resp3.json()["answer"].lower()
    assert "run out of money" in ans3 or "projected" in ans3

