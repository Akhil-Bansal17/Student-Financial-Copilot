import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User


@pytest.fixture(autouse=True)
def cleanup_insight_test_users():
    """Clean up test users and related records before and after each test."""
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%insighttest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str, name: str = "Insight Student") -> str:
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


# =========================================================================
# 1. AUTHENTICATION & OWNERSHIP ISOLATION
# =========================================================================

def test_insights_unauthenticated_rejected(client: TestClient):
    """Unauthenticated requests to insights are rejected with 401."""
    res = client.get("/api/v1/insights")
    assert res.status_code == 401


def test_insights_user_isolation(client: TestClient):
    """User A cannot see User B's insights."""
    token_a = get_auth_token(client, "insighttest_a@campus.edu", "Student A")
    token_b = get_auth_token(client, "insighttest_b@campus.edu", "Student B")

    # User B adds transactions in 2026-09
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "transaction_type": "income",
            "amount": "10000.00",
            "category": "Pocket Money",
            "payment_method": "UPI",
            "transaction_date": "2026-09-05T10:00:00Z",
        },
    )
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "transaction_type": "expense",
            "amount": "3000.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-06T12:00:00Z",
        },
    )

    # User A requests insights for 2026-09: should have 0 data
    res_a = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["has_sufficient_data"] is False
    assert len(data_a["insights"]) == 0

    # User B requests insights for 2026-09: should have insights
    res_b = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["has_sufficient_data"] is True
    assert data_b["summary"]["total_insights_count"] > 0


# =========================================================================
# 2. EMPTY DATA / INSUFFICIENT DATA
# =========================================================================

def test_insights_empty_data(client: TestClient):
    """User with no transactions, budgets, or goals receives a clean empty state."""
    token = get_auth_token(client, "insighttest_empty@campus.edu", "Empty Student")

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["has_sufficient_data"] is False
    assert data["summary"]["total_insights_count"] == 0
    assert data["summary"]["positive_count"] == 0
    assert data["summary"]["warning_count"] == 0
    assert data["summary"]["info_count"] == 0
    assert data["insights"] == []


# =========================================================================
# 3. CASH FLOW INSIGHTS
# =========================================================================

def test_insights_positive_cash_flow(client: TestClient):
    """Generates positive cash flow insight when income > expenses."""
    token = get_auth_token(client, "insighttest_cf_pos@campus.edu", "Cash Flow Pos")

    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "income",
            "amount": "12000.00",
            "category": "Pocket Money",
            "payment_method": "UPI",
            "transaction_date": "2026-09-02T10:00:00Z",
        },
    )
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "4500.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-05T12:00:00Z",
        },
    )

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    insights = res.json()["insights"]

    cf = next((i for i in insights if i["type"] == "cash_flow"), None)
    assert cf is not None
    assert cf["priority"] == "positive"
    assert cf["title"] == "Positive Monthly Cash Flow"
    assert "7,500.00" in cf["description"]
    assert Decimal(str(cf["amount"])) == Decimal("7500.00")


def test_insights_negative_cash_flow(client: TestClient):
    """Generates warning cash flow insight when expenses > income."""
    token = get_auth_token(client, "insighttest_cf_neg@campus.edu", "Cash Flow Neg")

    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "income",
            "amount": "3000.00",
            "category": "Scholarship",
            "payment_method": "Bank Transfer",
            "transaction_date": "2026-09-02T10:00:00Z",
        },
    )
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "5500.00",
            "category": "Education",
            "payment_method": "UPI",
            "transaction_date": "2026-09-05T12:00:00Z",
        },
    )

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    insights = res.json()["insights"]

    cf = next((i for i in insights if i["type"] == "cash_flow"), None)
    assert cf is not None
    assert cf["priority"] == "warning"
    assert cf["title"] == "Negative Monthly Cash Flow"
    assert "2,500.00" in cf["description"]


# =========================================================================
# 4. TOP CATEGORY & SPENDING CONCENTRATION
# =========================================================================

def test_insights_top_category_and_concentration(client: TestClient):
    """Detects top spending category and triggers concentration warning if >= 60%."""
    token = get_auth_token(client, "insighttest_cat@campus.edu", "Cat Student")

    # Food: 7000, Transport: 1000, Entertainment: 500 -> Total: 8500
    # Food is 7000 / 8500 = 82.4% (> 60% threshold)
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "7000.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-05T12:00:00Z",
        },
    )
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "1000.00",
            "category": "Transport",
            "payment_method": "UPI",
            "transaction_date": "2026-09-08T12:00:00Z",
        },
    )
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "500.00",
            "category": "Entertainment",
            "payment_method": "UPI",
            "transaction_date": "2026-09-10T12:00:00Z",
        },
    )

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    insights = res.json()["insights"]

    top_cat = next((i for i in insights if i["type"] == "top_category"), None)
    assert top_cat is not None
    assert top_cat["category"] == "Food"
    assert top_cat["title"] == "Top Expense: Food"
    assert Decimal(str(top_cat["amount"])) == Decimal("7000.00")

    conc = next((i for i in insights if i["type"] == "spending_concentration"), None)
    assert conc is not None
    assert conc["priority"] == "warning"
    assert "High Spending Concentration" in conc["title"]


# =========================================================================
# 5. MONTH-OVER-MONTH TRENDS & CHANGES
# =========================================================================

def test_insights_month_over_month_trend(client: TestClient):
    """Generates monthly change and category trend comparisons when previous month data exists."""
    token = get_auth_token(client, "insighttest_mom@campus.edu", "MoM Student")

    # August 2026: Food: 2000.00
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "2000.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-08-15T12:00:00Z",
        },
    )

    # September 2026: Food: 3000.00 (+50.0%)
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "3000.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-15T12:00:00Z",
        },
    )

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    insights = res.json()["insights"]

    # Monthly total change
    m_change = next((i for i in insights if i["type"] == "monthly_change"), None)
    assert m_change is not None
    assert m_change["title"] == "Total Expenses Increased"
    assert "50.0%" in m_change["description"]

    # Category trend
    trend = next((i for i in insights if i["type"] == "spending_trend" and i["category"] == "Food"), None)
    assert trend is not None
    assert trend["title"] == "Food Spending Increased"
    assert "50.0%" in trend["description"]


# =========================================================================
# 6. BUDGET INSIGHTS
# =========================================================================

def test_insights_budget_over_and_approaching(client: TestClient):
    """Detects budget exceeded and approaching limit (>80%)."""
    token = get_auth_token(client, "insighttest_budget@campus.edu", "Budget Student")

    # Budget 1: Food cap ₹2000. Spent ₹2200 (over budget)
    client.post(
        "/api/v1/budgets",
        headers={"Authorization": f"Bearer {token}"},
        json={"year": 2026, "month": 9, "category": "Food", "amount": "2000.00"},
    )
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "2200.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-10T12:00:00Z",
        },
    )

    # Budget 2: Entertainment cap ₹1000. Spent ₹850 (85.0% used, approaching)
    client.post(
        "/api/v1/budgets",
        headers={"Authorization": f"Bearer {token}"},
        json={"year": 2026, "month": 9, "category": "Entertainment", "amount": "1000.00"},
    )
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "850.00",
            "category": "Entertainment",
            "payment_method": "UPI",
            "transaction_date": "2026-09-11T12:00:00Z",
        },
    )

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    insights = res.json()["insights"]

    food_budget_insight = next(
        (i for i in insights if i["type"] == "budget" and i["category"] == "Food"), None
    )
    assert food_budget_insight is not None
    assert food_budget_insight["priority"] == "warning"
    assert "Over Budget" in food_budget_insight["title"]
    assert "200.00" in food_budget_insight["description"]

    ent_budget_insight = next(
        (i for i in insights if i["type"] == "budget" and i["category"] == "Entertainment"), None
    )
    assert ent_budget_insight is not None
    assert ent_budget_insight["priority"] == "warning"
    assert "Near Budget Limit" in ent_budget_insight["title"]
    assert "85.0%" in ent_budget_insight["description"]


# =========================================================================
# 7. SAVINGS GOAL INSIGHTS
# =========================================================================

def test_insights_goal_statuses(client: TestClient):
    """Detects active, completed, and overdue savings goals."""
    token = get_auth_token(client, "insighttest_goals@campus.edu", "Goal Insights Student")

    # Goal 1: Active
    g1 = client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Laptop", "target_amount": "50000.00", "target_date": "2026-12-31"},
    ).json()
    client.post(
        f"/api/v1/goals/{g1['id']}/contribute",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": "20000.00"},
    )

    # Goal 2: Completed
    g2 = client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Textbook", "target_amount": "3000.00"},
    ).json()
    client.post(
        f"/api/v1/goals/{g2['id']}/contribute",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": "3000.00"},
    )

    # Goal 3: Overdue (target date in the past, underfunded)
    client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Trip", "target_amount": "6000.00", "target_date": "2026-01-01"},
    )

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    insights = res.json()["insights"]

    goal_insights = [i for i in insights if i["type"] == "goal"]
    assert len(goal_insights) == 3

    completed = next((i for i in goal_insights if "Goal Reached" in i["title"]), None)
    assert completed is not None
    assert completed["priority"] == "positive"
    assert "Textbook" in completed["title"]

    overdue = next((i for i in goal_insights if "Overdue" in i["title"]), None)
    assert overdue is not None
    assert overdue["priority"] == "warning"
    assert "Trip" in overdue["title"]

    active = next((i for i in goal_insights if "Goal Progress" in i["title"]), None)
    assert active is not None
    assert active["priority"] == "info"
    assert "Laptop" in active["title"]
    assert "40.0%" in active["description"]


# =========================================================================
# 8. RECURRING EXPENSE PATTERN DETECTION
# =========================================================================

def test_insights_recurring_expense_pattern(client: TestClient):
    """Detects recurring weekly and monthly expenses conservatively (3+ occurrences, regular interval)."""
    token = get_auth_token(client, "insighttest_recur@campus.edu", "Recur Student")

    # Weekly pattern: Food ₹350 on Sep 1, Sep 8, Sep 15 (intervals: 7 days, 7 days)
    dates = ["2026-09-01T12:00:00Z", "2026-09-08T12:00:00Z", "2026-09-15T12:00:00Z"]
    for dt in dates:
        client.post(
            "/api/v1/transactions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "transaction_type": "expense",
                "amount": "350.00",
                "category": "Food",
                "payment_method": "UPI",
                "transaction_date": dt,
            },
        )

    # Monthly pattern: Bills ₹499 on Jul 01, Aug 01, Sep 01 (intervals: 31 days, 31 days)
    m_dates = ["2026-07-01T10:00:00Z", "2026-08-01T10:00:00Z", "2026-09-01T10:00:00Z"]
    for dt in m_dates:
        client.post(
            "/api/v1/transactions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "transaction_type": "expense",
                "amount": "499.00",
                "category": "Bills",
                "payment_method": "Debit Card",
                "transaction_date": dt,
            },
        )

    res = client.get(
        "/api/v1/insights?year=2026&month=9",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    insights = res.json()["insights"]

    recurring = [i for i in insights if i["type"] == "recurring_pattern"]
    assert len(recurring) >= 2

    weekly = next((i for i in recurring if i["category"] == "Food"), None)
    assert weekly is not None
    assert "weekly" in weekly["description"]
    assert Decimal(str(weekly["amount"])) == Decimal("350.00")

    monthly = next((i for i in recurring if i["category"] == "Bills"), None)
    assert monthly is not None
    assert "monthly" in monthly["description"]
    assert Decimal(str(monthly["amount"])) == Decimal("499.00")
