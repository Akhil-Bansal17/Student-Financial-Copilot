import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User
from app.models.budget import Budget
from app.models.transaction import Transaction


@pytest.fixture(autouse=True)
def cleanup_budget_test_users():
    """Clean up test users, budgets, and transactions before and after each test."""
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%budgettest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str, name: str = "Budget Student") -> str:
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
# 1. AUTHENTICATION & OWNERSHIP
# =========================================================================

def test_unauthenticated_access_rejected(client: TestClient):
    """Unauthenticated requests to budget endpoints are strictly rejected with 401."""
    assert client.post("/api/v1/budgets", json={}).status_code == 401
    assert client.get("/api/v1/budgets").status_code == 401
    assert client.get("/api/v1/budgets/summary").status_code == 401
    assert client.get("/api/v1/budgets/1").status_code == 401
    assert client.patch("/api/v1/budgets/1", json={}).status_code == 401
    assert client.delete("/api/v1/budgets/1").status_code == 401


def test_budget_ownership_isolation(client: TestClient):
    """User A cannot view, edit, or delete User B's budgets."""
    token_a = get_auth_token(client, "budgettest_user_a@campus.edu", "Student A")
    token_b = get_auth_token(client, "budgettest_user_b@campus.edu", "Student B")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a budget
    create_res = client.post(
        "/api/v1/budgets",
        headers=headers_a,
        json={"year": 2026, "month": 9, "category": "Food", "amount": "3000.00"},
    )
    assert create_res.status_code == 201
    budget_id = create_res.json()["id"]

    # User B cannot access User A's budget by ID (404)
    get_res = client.get(f"/api/v1/budgets/{budget_id}", headers=headers_b)
    assert get_res.status_code == 404

    # User B cannot update User A's budget (404)
    patch_res = client.patch(
        f"/api/v1/budgets/{budget_id}",
        headers=headers_b,
        json={"amount": "5000.00"},
    )
    assert patch_res.status_code == 404

    # User B cannot delete User A's budget (404)
    del_res = client.delete(f"/api/v1/budgets/{budget_id}", headers=headers_b)
    assert del_res.status_code == 404

    # User B listing budgets does not include User A's budget
    list_res = client.get("/api/v1/budgets", headers=headers_b)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 0


# =========================================================================
# 2. VALIDATION & CREATION
# =========================================================================

def test_create_valid_overall_and_category_budgets(client: TestClient):
    """User can create both overall monthly budget and category budgets."""
    token = get_auth_token(client, "budgettest_valid@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Overall monthly budget (category is null or empty)
    res_overall = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": None, "amount": "15000.00"},
    )
    assert res_overall.status_code == 201
    data_overall = res_overall.json()
    assert data_overall["year"] == 2026
    assert data_overall["month"] == 9
    assert data_overall["category"] is None
    assert data_overall["amount"] == "15000.00"

    # 2. Category budget
    res_cat = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Food", "amount": "3000.00"},
    )
    assert res_cat.status_code == 201
    data_cat = res_cat.json()
    assert data_cat["category"] == "Food"
    assert data_cat["amount"] == "3000.00"


def test_budget_creation_validations(client: TestClient):
    """Rejects invalid amount, zero, negative, invalid month, invalid category, income category."""
    token = get_auth_token(client, "budgettest_val@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Zero amount
    res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Food", "amount": "0.00"},
    )
    assert res.status_code == 422

    # Negative amount
    res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Food", "amount": "-100.00"},
    )
    assert res.status_code == 422

    # Invalid month (13)
    res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 13, "category": "Food", "amount": "1000.00"},
    )
    assert res.status_code == 422

    # Invalid month (0)
    res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 0, "category": "Food", "amount": "1000.00"},
    )
    assert res.status_code == 422

    # Invalid category (Random category not in EXPENSE_CATEGORIES)
    res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Cryptocurrency", "amount": "1000.00"},
    )
    assert res.status_code == 422

    # Income category rejected (e.g. Salary, Pocket Money)
    res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Salary", "amount": "1000.00"},
    )
    assert res.status_code == 422

    res_pm = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Pocket Money", "amount": "1000.00"},
    )
    assert res_pm.status_code == 422


def test_duplicate_budget_rejected(client: TestClient):
    """Prevent duplicate budgets for user + year + month + category."""
    token = get_auth_token(client, "budgettest_dup@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Create initial category budget
    res1 = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Food", "amount": "3000.00"},
    )
    assert res1.status_code == 201

    # Attempt duplicate category budget
    res2 = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Food", "amount": "4000.00"},
    )
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]

    # Create initial overall budget
    res3 = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": None, "amount": "10000.00"},
    )
    assert res3.status_code == 201

    # Attempt duplicate overall budget
    res4 = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": None, "amount": "12000.00"},
    )
    assert res4.status_code == 400
    assert "already exists" in res4.json()["detail"]


# =========================================================================
# 3. CRUD OPERATIONS
# =========================================================================

def test_budget_crud_lifecycle(client: TestClient):
    """Full lifecycle: create, get by id, list, update, and delete."""
    token = get_auth_token(client, "budgettest_crud@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create
    res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Transport", "amount": "2500.00"},
    )
    assert res.status_code == 201
    b_id = res.json()["id"]

    # 2. Get by ID
    res_get = client.get(f"/api/v1/budgets/{b_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["amount"] == "2500.00"
    assert res_get.json()["category"] == "Transport"

    # 3. Update amount
    res_patch = client.patch(
        f"/api/v1/budgets/{b_id}",
        headers=headers,
        json={"amount": "3200.00"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["amount"] == "3200.00"

    # 4. List budgets
    res_list = client.get("/api/v1/budgets?year=2026&month=9", headers=headers)
    assert res_list.status_code == 200
    items = res_list.json()
    assert len(items) == 1
    assert items[0]["id"] == b_id

    # 5. Delete
    res_del = client.delete(f"/api/v1/budgets/{b_id}", headers=headers)
    assert res_del.status_code == 200

    # 6. Verify deleted
    res_get2 = client.get(f"/api/v1/budgets/{b_id}", headers=headers)
    assert res_get2.status_code == 404


# =========================================================================
# 4. REAL-TIME CALCULATIONS & TRANSACTION INTEGRATION
# =========================================================================

def test_budget_calculations_under_and_over_budget(client: TestClient):
    """
    Test real calculations with real transactions:
    - Under budget: Budget = ₹3,000, Spent = ₹2,100 -> Remaining = ₹900, Util = 70.0%, Over = false
    - Over budget: Budget = ₹3,000, Spent = ₹3,400 -> Remaining = -₹400, Util = 113.3%, Over = true
    """
    token = get_auth_token(client, "budgettest_calc@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Create Food budget: ₹3,000
    b_res = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": "Food", "amount": "3000.00"},
    )
    assert b_res.status_code == 201
    budget_id = b_res.json()["id"]

    # Initial state: 0 spent
    summary_init = client.get("/api/v1/budgets/summary?year=2026&month=9", headers=headers).json()
    food_cat = next(c for c in summary_init["category_budgets"] if c["category"] == "Food")
    assert food_cat["spent"] == "0.00"
    assert food_cat["remaining"] == "3000.00"
    assert food_cat["utilization"] == "0.0"
    assert food_cat["over_budget"] is False

    # Add expense of ₹2,100 on 2026-09-10
    tx1_res = client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "expense",
            "amount": "2100.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-10T12:00:00Z",
        },
    )
    assert tx1_res.status_code == 201
    tx1_id = tx1_res.json()["id"]

    # Verify Under budget state:
    summary_under = client.get("/api/v1/budgets/summary?year=2026&month=9", headers=headers).json()
    food_under = next(c for c in summary_under["category_budgets"] if c["category"] == "Food")
    assert food_under["spent"] == "2100.00"
    assert food_under["remaining"] == "900.00"
    assert food_under["utilization"] == "70.0"
    assert food_under["over_budget"] is False

    # Also check individual budget endpoint
    b_indiv = client.get(f"/api/v1/budgets/{budget_id}", headers=headers).json()
    assert b_indiv["actual_spending"] == "2100.00"
    assert b_indiv["remaining"] == "900.00"
    assert b_indiv["utilization_percentage"] == "70.0"
    assert b_indiv["over_budget"] is False

    # Add another expense of ₹1,300 to bring total spent to ₹3,400 (Over budget)
    tx2_res = client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "expense",
            "amount": "1300.00",
            "category": "Food",
            "payment_method": "Cash",
            "transaction_date": "2026-09-15T15:00:00Z",
        },
    )
    assert tx2_res.status_code == 201
    tx2_id = tx2_res.json()["id"]

    # Verify Over budget state:
    # 3400 / 3000 * 100 = 113.333... -> 113.3%
    summary_over = client.get("/api/v1/budgets/summary?year=2026&month=9", headers=headers).json()
    food_over = next(c for c in summary_over["category_budgets"] if c["category"] == "Food")
    assert food_over["spent"] == "3400.00"
    assert food_over["remaining"] == "-400.00"
    assert food_over["utilization"] == "113.3"
    assert food_over["over_budget"] is True

    # Test editing transaction: change tx2 from ₹1,300 to ₹900 (Total = ₹3,000 -> 100% exactly)
    client.patch(f"/api/v1/transactions/{tx2_id}", headers=headers, json={"amount": "900.00"})
    summary_exact = client.get("/api/v1/budgets/summary?year=2026&month=9", headers=headers).json()
    food_exact = next(c for c in summary_exact["category_budgets"] if c["category"] == "Food")
    assert food_exact["spent"] == "3000.00"
    assert food_exact["remaining"] == "0.00"
    assert food_exact["utilization"] == "100.0"
    assert food_exact["over_budget"] is False

    # Test deleting transaction: delete tx2 (Total returns to ₹2,100)
    client.delete(f"/api/v1/transactions/{tx2_id}", headers=headers)
    summary_del = client.get("/api/v1/budgets/summary?year=2026&month=9", headers=headers).json()
    food_del = next(c for c in summary_del["category_budgets"] if c["category"] == "Food")
    assert food_del["spent"] == "2100.00"
    assert food_del["remaining"] == "900.00"
    assert food_del["utilization"] == "70.0"


def test_overall_budget_calculations(client: TestClient):
    """Overall monthly budget aggregates all expenses across all categories."""
    token = get_auth_token(client, "budgettest_overall@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Set overall budget = ₹10,000
    res_b = client.post(
        "/api/v1/budgets",
        headers=headers,
        json={"year": 2026, "month": 9, "category": None, "amount": "10000.00"},
    )
    assert res_b.status_code == 201

    # Add Food expense ₹3,000 and Transport expense ₹2,000
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "expense",
            "amount": "3000.00",
            "category": "Food",
            "payment_method": "UPI",
            "transaction_date": "2026-09-02T10:00:00Z",
        },
    )
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "expense",
            "amount": "2000.00",
            "category": "Transport",
            "payment_method": "Debit Card",
            "transaction_date": "2026-09-05T10:00:00Z",
        },
    )
    # Also add an income transaction of ₹15,000 (must NOT count as spending)
    client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "transaction_type": "income",
            "amount": "15000.00",
            "category": "Pocket Money",
            "payment_method": "Bank Transfer",
            "transaction_date": "2026-09-01T10:00:00Z",
        },
    )

    summary = client.get("/api/v1/budgets/summary?year=2026&month=9", headers=headers).json()
    assert summary["has_overall_budget"] is True
    assert summary["overall_budget"] == "10000.00"
    assert summary["overall_spending"] == "5000.00"
    assert summary["overall_remaining"] == "5000.00"
    assert summary["overall_utilization"] == "50.0"
    assert summary["overall_over_budget"] is False


def test_empty_budget_states(client: TestClient):
    """Summary returns proper empty states when no budgets are set."""
    token = get_auth_token(client, "budgettest_empty@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    summary = client.get("/api/v1/budgets/summary?year=2026&month=9", headers=headers).json()
    assert summary["year"] == 2026
    assert summary["month"] == 9
    assert summary["has_overall_budget"] is False
    assert summary["overall_budget"] is None
    assert summary["overall_spending"] == "0.00"
    assert summary["overall_remaining"] is None
    assert summary["overall_utilization"] is None
    assert summary["overall_over_budget"] is False
    assert summary["category_budgets"] == []
    assert summary["total_categories_budgeted"] == 0
    assert summary["has_any_budget"] is False
