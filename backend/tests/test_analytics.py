import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction


@pytest.fixture(autouse=True)
def cleanup_analytics_test_users():
    """Clean up test users, profiles, and transactions before and after each test."""
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%analyticstest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str, name: str = "Analytics Student") -> str:
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


def test_analytics_summary_empty_profile(client: TestClient):
    """1. Summary returns zeros and starting_balance=0.00 when user has no transactions or profile."""
    token = get_auth_token(client, "analyticstest_empty@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/analytics/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["starting_balance"] == "0.00"
    assert data["total_income"] == "0.00"
    assert data["total_expenses"] == "0.00"
    assert data["net_cash_flow"] == "0.00"
    assert data["current_balance"] == "0.00"
    assert data["income_transaction_count"] == 0
    assert data["expense_transaction_count"] == 0
    assert data["currency"] == "INR"


def test_analytics_summary_with_transactions_and_profile(client: TestClient):
    """2. Summary properly integrates starting_balance and aggregates income and expenses."""
    token = get_auth_token(client, "analyticstest_sum@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Set starting balance via profile update
    prof_res = client.patch(
        "/api/v1/profile/financial",
        json={"starting_balance": "2500.00"},
        headers=headers,
    )
    assert prof_res.status_code == 200

    # Add income 1: 5000.00
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "5000.00",
            "category": "Pocket Money",
            "payment_method": "UPI",
        },
        headers=headers,
    )
    # Add income 2: 1200.50
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "1200.50",
            "category": "Freelance",
            "payment_method": "Bank Transfer",
        },
        headers=headers,
    )
    # Add expense: 700.25
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "700.25",
            "category": "Food",
            "payment_method": "UPI",
        },
        headers=headers,
    )

    res = client.get("/api/v1/analytics/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Total income = 6200.50, Total expenses = 700.25
    # Net cash flow = 6200.50 - 700.25 = 5500.25
    # Current balance = 2500.00 + 5500.25 = 8000.25
    assert data["starting_balance"] == "2500.00"
    assert data["total_income"] == "6200.50"
    assert data["total_expenses"] == "700.25"
    assert data["net_cash_flow"] == "5500.25"
    assert data["current_balance"] == "8000.25"
    assert data["income_transaction_count"] == 2
    assert data["expense_transaction_count"] == 1


def test_monthly_analytics_with_mom_comparison(client: TestClient):
    """3. Monthly analytics correctly calculates MoM changes and handles zero previous-month safely."""
    token = get_auth_token(client, "analyticstest_monthly@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Month 1: August 2026
    # Previous month income: 4000.00, expenses: 1000.00
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "4000.00",
            "category": "Pocket Money",
            "payment_method": "UPI",
            "transaction_date": "2026-08-10T12:00:00Z",
        },
        headers=headers,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "1000.00",
            "category": "Food",
            "payment_method": "Cash",
            "transaction_date": "2026-08-15T12:00:00Z",
        },
        headers=headers,
    )

    # Month 2: September 2026
    # Current month income: 5000.00 (+25.0%), expenses: 1500.00 (+50.0%)
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "5000.00",
            "category": "Pocket Money",
            "payment_method": "UPI",
            "transaction_date": "2026-09-05T12:00:00Z",
        },
        headers=headers,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "1500.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-12T12:00:00Z",
        },
        headers=headers,
    )

    # Query September 2026
    res = client.get("/api/v1/analytics/monthly?year=2026&month=9", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["year"] == 2026
    assert data["month"] == 9
    assert data["monthly_income"] == "5000.00"
    assert data["monthly_expenses"] == "1500.00"
    assert data["monthly_net_cash_flow"] == "3500.00"
    assert data["transaction_count"] == 2
    assert data["previous_month_income"] == "4000.00"
    assert data["previous_month_expenses"] == "1000.00"
    assert data["previous_month_net_cash_flow"] == "3000.00"
    # (5000 - 4000) / 4000 * 100 = 25.0%
    assert data["income_change_percentage"] == "25.0"
    # (1500 - 1000) / 1000 * 100 = 50.0%
    assert data["expense_change_percentage"] == "50.0"

    # Query August 2026 (previous month July had 0 transactions -> percentage change must be null)
    res_aug = client.get("/api/v1/analytics/monthly?year=2026&month=8", headers=headers)
    assert res_aug.status_code == 200
    data_aug = res_aug.json()
    assert data_aug["previous_month_income"] == "0.00"
    assert data_aug["income_change_percentage"] is None
    assert data_aug["expense_change_percentage"] is None


def test_category_spending_breakdown(client: TestClient):
    """4. Category spending returns exact grouped totals, percentages, and handles zero expenses."""
    token = get_auth_token(client, "analyticstest_cat@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Food: 3000.00 (60.0%)
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "3000.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-02T10:00:00Z",
        },
        headers=headers,
    )
    # Transport: 2000.00 (40.0%)
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "2000.00",
            "category": "Transport",
            "payment_method": "Cash",
            "transaction_date": "2026-09-04T10:00:00Z",
        },
        headers=headers,
    )

    res = client.get("/api/v1/analytics/categories?year=2026&month=9", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_expenses"] == "5000.00"
    items = data["items"]
    assert len(items) == 2
    assert items[0]["category"] == "Food"
    assert items[0]["amount"] == "3000.00"
    assert items[0]["percentage"] == "60.0"
    assert items[0]["transaction_count"] == 1

    assert items[1]["category"] == "Transport"
    assert items[1]["amount"] == "2000.00"
    assert items[1]["percentage"] == "40.0"

    # Query empty month
    res_empty = client.get("/api/v1/analytics/categories?year=2026&month=1", headers=headers)
    assert res_empty.status_code == 200
    assert res_empty.json()["total_expenses"] == "0.00"
    assert res_empty.json()["items"] == []


def test_income_category_breakdown(client: TestClient):
    """5. Income breakdown correctly returns categories and percentages."""
    token = get_auth_token(client, "analyticstest_inc@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "8000.00",
            "category": "Pocket Money",
            "payment_method": "Bank Transfer",
            "transaction_date": "2026-09-01T08:00:00Z",
        },
        headers=headers,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "2000.00",
            "category": "Freelance",
            "payment_method": "UPI",
            "transaction_date": "2026-09-03T08:00:00Z",
        },
        headers=headers,
    )

    res = client.get("/api/v1/analytics/income-categories?year=2026&month=9", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_income"] == "10000.00"
    assert len(data["items"]) == 2
    assert data["items"][0]["category"] == "Pocket Money"
    assert data["items"][0]["amount"] == "8000.00"
    assert data["items"][0]["percentage"] == "80.0"
    assert data["items"][1]["category"] == "Freelance"
    assert data["items"][1]["amount"] == "2000.00"
    assert data["items"][1]["percentage"] == "20.0"


def test_daily_spending_trend(client: TestClient):
    """6. Daily trend includes all days of the month with zero-padding and accurate non-zero days."""
    token = get_auth_token(client, "analyticstest_trend@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Add transaction on Sep 02
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "5000.00",
            "category": "Pocket Money",
            "payment_method": "UPI",
            "transaction_date": "2026-09-02T10:00:00Z",
        },
        headers=headers,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "100.00",
            "category": "Food",
            "payment_method": "Cash",
            "transaction_date": "2026-09-02T12:00:00Z",
        },
        headers=headers,
    )

    res = client.get("/api/v1/analytics/trend?year=2026&month=9", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # September has 30 days
    assert len(data["days"]) == 30
    assert data["days"][0]["date"] == "2026-09-01"
    assert data["days"][0]["income"] == "0.00"
    assert data["days"][0]["expenses"] == "0.00"
    assert data["days"][0]["net"] == "0.00"

    # Sep 02
    assert data["days"][1]["date"] == "2026-09-02"
    assert data["days"][1]["income"] == "5000.00"
    assert data["days"][1]["expenses"] == "100.00"
    assert data["days"][1]["net"] == "4900.00"

    # Last day
    assert data["days"][29]["date"] == "2026-09-30"


def test_validation_invalid_month_and_year(client: TestClient):
    """7. Rejects invalid month and year parameters with 422."""
    token = get_auth_token(client, "analyticstest_valid@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # month 0
    res = client.get("/api/v1/analytics/monthly?year=2026&month=0", headers=headers)
    assert res.status_code == 422

    # month 13
    res = client.get("/api/v1/analytics/monthly?year=2026&month=13", headers=headers)
    assert res.status_code == 422

    # year out of range
    res = client.get("/api/v1/analytics/monthly?year=1800&month=5", headers=headers)
    assert res.status_code == 422


def test_user_data_isolation(client: TestClient):
    """8. Ensures complete isolation: User B never sees User A's financial transactions or analytics."""
    token_a = get_auth_token(client, "analyticstest_user_a@campus.edu", name="User A")
    token_b = get_auth_token(client, "analyticstest_user_b@campus.edu", name="User B")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A records transactions
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "9999.00",
            "category": "Salary",
            "payment_method": "Bank Transfer",
            "transaction_date": "2026-09-10T10:00:00Z",
        },
        headers=headers_a,
    )
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "4444.00",
            "category": "Education",
            "payment_method": "Debit Card",
            "transaction_date": "2026-09-15T10:00:00Z",
        },
        headers=headers_a,
    )

    # User B queries summary
    res_b_sum = client.get("/api/v1/analytics/summary", headers=headers_b)
    assert res_b_sum.status_code == 200
    assert res_b_sum.json()["total_income"] == "0.00"
    assert res_b_sum.json()["total_expenses"] == "0.00"
    assert res_b_sum.json()["current_balance"] == "0.00"

    # User B queries monthly
    res_b_mon = client.get("/api/v1/analytics/monthly?year=2026&month=9", headers=headers_b)
    assert res_b_mon.status_code == 200
    assert res_b_mon.json()["monthly_income"] == "0.00"
    assert res_b_mon.json()["monthly_expenses"] == "0.00"
    assert res_b_mon.json()["transaction_count"] == 0

    # User B queries categories
    res_b_cat = client.get("/api/v1/analytics/categories?year=2026&month=9", headers=headers_b)
    assert res_b_cat.status_code == 200
    assert res_b_cat.json()["total_expenses"] == "0.00"
    assert res_b_cat.json()["items"] == []


def test_unauthenticated_requests_rejected(client: TestClient):
    """9. Unauthenticated requests to all analytics endpoints are rejected with 401."""
    endpoints = [
        "/api/v1/analytics/summary",
        "/api/v1/analytics/monthly",
        "/api/v1/analytics/categories",
        "/api/v1/analytics/income-categories",
        "/api/v1/analytics/trend",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401
