from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from app.db.session import SessionLocal
from app.models.user import User
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction


@pytest.fixture(autouse=True)
def cleanup_transaction_test_users():
    """Clean up test users, profiles, and transactions before and after each test."""
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%txtest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str, name: str = "Test Student") -> str:
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


def test_create_income_transaction(client: TestClient):
    """1. Create income transaction with valid fields."""
    token = get_auth_token(client, "txtest_income@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "transaction_type": "income",
        "amount": "5000.00",
        "category": "Pocket Money",
        "description": "Monthly allowance from parents",
        "payment_method": "UPI",
    }
    response = client.post("/api/v1/transactions", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["transaction_type"] == "income"
    assert float(data["amount"]) == 5000.00
    assert data["category"] == "Pocket Money"
    assert data["payment_method"] == "UPI"
    assert data["description"] == "Monthly allowance from parents"
    assert "id" in data


def test_create_expense_transaction(client: TestClient):
    """2. Create expense transaction with valid fields."""
    token = get_auth_token(client, "txtest_expense@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "transaction_type": "expense",
        "amount": "250.50",
        "category": "Food",
        "description": "Campus Canteen Lunch",
        "payment_method": "Cash",
    }
    response = client.post("/api/v1/transactions", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["transaction_type"] == "expense"
    assert float(data["amount"]) == 250.50
    assert data["category"] == "Food"


def test_amount_decimal_precision(client: TestClient):
    """3. Decimal amounts preserve exact precision."""
    token = get_auth_token(client, "txtest_decimal@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "transaction_type": "expense",
        "amount": "0.50",
        "category": "Transport",
        "payment_method": "UPI",
    }
    response = client.post("/api/v1/transactions", json=payload, headers=headers)
    assert response.status_code == 201
    assert str(response.json()["amount"]) == "0.50"


def test_negative_and_zero_amount_rejected(client: TestClient):
    """4. Zero, negative, and invalid amounts are rejected."""
    token = get_auth_token(client, "txtest_invalid_amt@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Zero amount
    r_zero = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "0",
            "category": "Food",
            "payment_method": "Cash",
        },
        headers=headers,
    )
    assert r_zero.status_code == 422

    # Negative amount
    r_neg = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "-50.00",
            "category": "Food",
            "payment_method": "Cash",
        },
        headers=headers,
    )
    assert r_neg.status_code == 422


def test_invalid_transaction_type_rejected(client: TestClient):
    """5. Invalid transaction type is rejected."""
    token = get_auth_token(client, "txtest_inv_type@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "investment",
            "amount": "100.00",
            "category": "Other",
            "payment_method": "Cash",
        },
        headers=headers,
    )
    assert response.status_code == 422


def test_invalid_category_for_type_rejected(client: TestClient):
    """6. Invalid category or mismatched category/type is rejected."""
    token = get_auth_token(client, "txtest_inv_cat@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Non-existent category
    r_fake = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "100.00",
            "category": "Cryptocurrency",
            "payment_method": "UPI",
        },
        headers=headers,
    )
    assert r_fake.status_code == 422

    # Income category used as expense
    r_mismatch = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "100.00",
            "category": "Salary",  # Salary is income, not expense
            "payment_method": "UPI",
        },
        headers=headers,
    )
    assert r_mismatch.status_code == 422


def test_invalid_payment_method_rejected(client: TestClient):
    """7. Invalid payment method is rejected."""
    token = get_auth_token(client, "txtest_inv_pay@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "100.00",
            "category": "Food",
            "payment_method": "GoldBar",
        },
        headers=headers,
    )
    assert response.status_code == 422


def test_list_transactions_with_pagination(client: TestClient):
    """8. List transactions supports limit and offset."""
    token = get_auth_token(client, "txtest_pagination@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Create 3 transactions
    for i in range(1, 4):
        client.post(
            "/api/v1/transactions",
            json={
                "transaction_type": "expense",
                "amount": f"{i * 10}.00",
                "category": "Food",
                "payment_method": "Cash",
            },
            headers=headers,
        )

    # Fetch with limit=2, offset=0
    r1 = client.get("/api/v1/transactions?limit=2&offset=0", headers=headers)
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["total"] == 3
    assert len(data1["items"]) == 2
    assert data1["limit"] == 2
    assert data1["offset"] == 0

    # Fetch with limit=2, offset=2
    r2 = client.get("/api/v1/transactions?limit=2&offset=2", headers=headers)
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["total"] == 3
    assert len(data2["items"]) == 1


def test_filter_transactions_by_type_and_category(client: TestClient):
    """9. Filter transactions by type and category."""
    token = get_auth_token(client, "txtest_filters@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # 1 income
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "2000.00",
            "category": "Salary",
            "payment_method": "Bank Transfer",
        },
        headers=headers,
    )
    # 1 food expense
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "150.00",
            "category": "Food",
            "payment_method": "UPI",
        },
        headers=headers,
    )
    # 1 transport expense
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "50.00",
            "category": "Transport",
            "payment_method": "Cash",
        },
        headers=headers,
    )

    # Filter type=income
    r_inc = client.get("/api/v1/transactions?transaction_type=income", headers=headers)
    assert r_inc.status_code == 200
    assert r_inc.json()["total"] == 1
    assert r_inc.json()["items"][0]["category"] == "Salary"

    # Filter type=expense & category=Food
    r_food = client.get(
        "/api/v1/transactions?transaction_type=expense&category=Food", headers=headers
    )
    assert r_food.status_code == 200
    assert r_food.json()["total"] == 1
    assert float(r_food.json()["items"][0]["amount"]) == 150.00


def test_get_single_transaction_detail(client: TestClient):
    """10. Get single transaction detail."""
    token = get_auth_token(client, "txtest_detail@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "450.00",
            "category": "Education",
            "payment_method": "Debit Card",
            "description": "Textbook",
        },
        headers=headers,
    )
    tx_id = create_resp.json()["id"]

    get_resp = client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == tx_id
    assert get_resp.json()["description"] == "Textbook"


def test_update_transaction(client: TestClient):
    """11. Edit an existing transaction."""
    token = get_auth_token(client, "txtest_update@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "100.00",
            "category": "Food",
            "payment_method": "Cash",
        },
        headers=headers,
    )
    tx_id = create_resp.json()["id"]

    # Update amount and description
    patch_resp = client.patch(
        f"/api/v1/transactions/{tx_id}",
        json={"amount": "125.00", "description": "Updated Canteen snack"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert float(patch_resp.json()["amount"]) == 125.00
    assert patch_resp.json()["description"] == "Updated Canteen snack"


def test_delete_transaction(client: TestClient):
    """12. Delete an existing transaction."""
    token = get_auth_token(client, "txtest_delete@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "75.00",
            "category": "Entertainment",
            "payment_method": "UPI",
        },
        headers=headers,
    )
    tx_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert del_resp.status_code == 200

    # Ensure it no longer exists
    get_resp = client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert get_resp.status_code == 404


def test_financial_summary_calculation(client: TestClient):
    """13. Summary calculates starting_balance + income - expenses."""
    token = get_auth_token(client, "txtest_summary@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Initial summary with no profile or transactions -> 0.00
    s0 = client.get("/api/v1/transactions/summary", headers=headers)
    assert s0.status_code == 200
    assert float(s0.json()["current_balance"]) == 0.00
    assert float(s0.json()["total_income"]) == 0.00
    assert float(s0.json()["total_expenses"]) == 0.00

    # Add Income ₹3000
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "income",
            "amount": "3000.00",
            "category": "Salary",
            "payment_method": "Bank Transfer",
        },
        headers=headers,
    )

    # Add Expense ₹500
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "500.00",
            "category": "Food",
            "payment_method": "Cash",
        },
        headers=headers,
    )

    # Summary: 0 + 3000 - 500 = 2500
    s1 = client.get("/api/v1/transactions/summary", headers=headers)
    assert s1.status_code == 200
    data1 = s1.json()
    assert float(data1["starting_balance"]) == 0.00
    assert float(data1["total_income"]) == 3000.00
    assert float(data1["total_expenses"]) == 500.00
    assert float(data1["current_balance"]) == 2500.00


def test_summary_includes_onboarding_starting_balance(client: TestClient):
    """14. Summary incorporates starting_balance from financial profile."""
    token = get_auth_token(client, "txtest_start_bal@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Complete onboarding with starting balance ₹1,200.00
    client.post(
        "/api/v1/profile/onboarding/complete",
        json={
            "starting_balance": "1200.00",
            "money_sources": ["Pocket Money"],
            "financial_focus": ["Track my spending"],
        },
        headers=headers,
    )

    # Add expense of ₹200.00
    client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "200.00",
            "category": "Bills",
            "payment_method": "UPI",
        },
        headers=headers,
    )

    # Current balance = 1200 + 0 - 200 = 1000
    summary_resp = client.get("/api/v1/transactions/summary", headers=headers)
    assert summary_resp.status_code == 200
    data = summary_resp.json()
    assert float(data["starting_balance"]) == 1200.00
    assert float(data["total_expenses"]) == 200.00
    assert float(data["current_balance"]) == 1000.00


def test_user_isolation_for_transactions(client: TestClient):
    """15. User A cannot list, view, update, or delete User B's transactions."""
    token_a = get_auth_token(client, "txtest_user_a@campus.edu", "Student A")
    token_b = get_auth_token(client, "txtest_user_b@campus.edu", "Student B")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates transaction
    resp_a = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "expense",
            "amount": "300.00",
            "category": "Shopping",
            "payment_method": "Credit Card",
        },
        headers=headers_a,
    )
    tx_a_id = resp_a.json()["id"]

    # User B listing transactions does NOT include User A's transaction
    list_b = client.get("/api/v1/transactions", headers=headers_b)
    assert list_b.status_code == 200
    assert list_b.json()["total"] == 0

    # User B attempting to GET User A's transaction -> 404
    get_b = client.get(f"/api/v1/transactions/{tx_a_id}", headers=headers_b)
    assert get_b.status_code == 404

    # User B attempting to PATCH User A's transaction -> 404
    patch_b = client.patch(
        f"/api/v1/transactions/{tx_a_id}",
        json={"amount": "1.00"},
        headers=headers_b,
    )
    assert patch_b.status_code == 404

    # User B attempting to DELETE User A's transaction -> 404
    del_b = client.delete(f"/api/v1/transactions/{tx_a_id}", headers=headers_b)
    assert del_b.status_code == 404

    # Verify User A's transaction is still intact
    get_a = client.get(f"/api/v1/transactions/{tx_a_id}", headers=headers_a)
    assert get_a.status_code == 200
    assert float(get_a.json()["amount"]) == 300.00


def test_unauthenticated_transaction_access_rejected(client: TestClient):
    """16. Unauthenticated requests to transactions endpoints return 401."""
    assert client.get("/api/v1/transactions").status_code == 401
    assert client.get("/api/v1/transactions/summary").status_code == 401
    assert client.get("/api/v1/transactions/1").status_code == 401
    assert client.post("/api/v1/transactions", json={}).status_code == 401
    assert client.patch("/api/v1/transactions/1", json={}).status_code == 401
    assert client.delete("/api/v1/transactions/1").status_code == 401
