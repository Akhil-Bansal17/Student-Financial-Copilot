import datetime
from decimal import Decimal
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.goal import Goal
from app.services.ai_provider import AIProvider


@pytest.fixture(autouse=True)
def cleanup_copilot_test_users():
    """Clean up test users and related records before and after each test."""
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%copilottest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()

    yield

    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%copilottest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str, name: str = "Copilot Student") -> str:
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
# 1. AUTHENTICATION & ACCESS CONTROL
# =========================================================================

def test_copilot_unauthenticated_rejected(client: TestClient):
    """Unauthenticated requests to AI copilot are rejected with 401."""
    res = client.post("/api/v1/ai/copilot", json={"message": "Summarize my finances"})
    assert res.status_code == 401


# =========================================================================
# 2. USER ISOLATION
# =========================================================================

def test_copilot_user_isolation(client: TestClient):
    """User A's AI copilot query cannot receive or reflect User B's financial data."""
    token_a = get_auth_token(client, "copilottest_a@campus.edu", "Student A")
    token_b = get_auth_token(client, "copilottest_b@campus.edu", "Student B")

    # User B adds income and expenses
    res_inc = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "transaction_type": "income",
            "amount": "25000.00",
            "category": "Scholarship",
            "description": "Scholarship",
            "payment_method": "Bank Transfer",
            "transaction_date": "2026-09-05T10:00:00Z",
        },
    )
    assert res_inc.status_code == 201

    res_exp = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "transaction_type": "expense",
            "amount": "4800.00",
            "category": "Food",
            "description": "Groceries",
            "payment_method": "UPI",
            "transaction_date": "2026-09-10T14:30:00Z",
        },
    )
    assert res_exp.status_code == 201

    # User B creates a goal
    res_g = client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Secret B Laptop",
            "target_amount": "50000.00",
            "target_date": "2026-12-31",
            "category": "education",
        },
    )
    assert res_g.status_code == 201

    # User A asks for financial summary for 2026-09
    res_a = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"message": "Summarize my finances this month", "year": 2026, "month": 9},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()

    # Verify context_used for User A contains 0, none of User B's data
    context_a = data_a["context_used"]
    assert context_a["monthly_income"] == "0.00"
    assert context_a["monthly_expenses"] == "0.00"
    assert context_a["active_goals_count"] == 0
    assert "25000" not in data_a["answer"]
    assert "Secret B Laptop" not in data_a["answer"]
    assert "Groceries" not in data_a["answer"]

    # User B queries copilot
    res_b = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"message": "Summarize my finances this month", "year": 2026, "month": 9},
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    context_b = data_b["context_used"]
    assert context_b["monthly_income"] == "25000.00"
    assert context_b["monthly_expenses"] == "4800.00"
    assert context_b["active_goals_count"] == 1


# =========================================================================
# 3. REQUEST VALIDATION
# =========================================================================

def test_copilot_empty_message_rejected(client: TestClient):
    """Empty or whitespace-only messages are rejected with 422."""
    token = get_auth_token(client, "copilottest_val@campus.edu")

    # Empty string
    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": ""},
    )
    assert res.status_code == 422

    # Whitespace only
    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "    "},
    )
    assert res.status_code == 422


def test_copilot_message_length_limit(client: TestClient):
    """Messages exceeding 1000 characters are rejected with 422."""
    token = get_auth_token(client, "copilottest_len@campus.edu")

    long_message = "A" * 1001
    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": long_message},
    )
    assert res.status_code == 422


# =========================================================================
# 4. INSUFFICIENT FINANCIAL DATA HANDLING
# =========================================================================

def test_copilot_insufficient_financial_data(client: TestClient):
    """Copilot handles users with zero transactions/budgets/goals gracefully."""
    token = get_auth_token(client, "copilottest_nodata@campus.edu")

    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Summarize my finances this month", "year": 2026, "month": 9},
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert data["context_used"]["has_sufficient_data"] is False
    assert any(phrase in data["answer"].lower() for phrase in ["not enough", "enough verified", "no recorded"])


# =========================================================================
# 5. FINANCIAL QUESTIONS GROUNDED IN VERIFIED CONTEXT
# =========================================================================

def test_copilot_spending_category_question(client: TestClient):
    """Answers spending questions using verified transaction categories and amounts."""
    token = get_auth_token(client, "copilottest_spend@campus.edu")

    # Add transactions
    res1 = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "income",
            "amount": "15000.00",
            "category": "Pocket Money",
            "description": "Monthly allowance",
            "payment_method": "Bank Transfer",
            "transaction_date": "2026-09-01T09:00:00Z",
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "4200.00",
            "category": "Food",
            "description": "Campus dining",
            "payment_method": "UPI",
            "transaction_date": "2026-09-05T12:00:00Z",
        },
    )
    assert res2.status_code == 201

    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "How much did I spend on food this month?", "year": 2026, "month": 9},
    )
    assert res.status_code == 200
    data = res.json()
    # The verified 4,200 must be referenced
    assert "4,200" in data["answer"] or "4200" in data["answer"]
    assert "food" in data["answer"].lower()


def test_copilot_budget_limit_question(client: TestClient):
    """Answers budget questions using verified budget amounts and utilization."""
    token = get_auth_token(client, "copilottest_budget@campus.edu")

    # Set up budget: Food limit 5000
    res_b = client.post(
        "/api/v1/budgets",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "category": "Food",
            "amount": "5000.00",
            "month": 9,
            "year": 2026,
        },
    )
    assert res_b.status_code == 201

    # Expense 4500 (90% utilization)
    res_tx = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "4500.00",
            "category": "Food",
            "description": "Food expense",
            "payment_method": "UPI",
            "transaction_date": "2026-09-12T13:00:00Z",
        },
    )
    assert res_tx.status_code == 201

    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Am I close to exceeding any budget?", "year": 2026, "month": 9},
    )
    assert res.status_code == 200
    data = res.json()
    assert "food" in data["answer"].lower()
    assert "5,000" in data["answer"] or "5000" in data["answer"]
    assert "4,500" in data["answer"] or "4500" in data["answer"]


def test_copilot_goal_question(client: TestClient):
    """Answers goal questions using verified goal targets and current amounts."""
    token = get_auth_token(client, "copilottest_goal@campus.edu")

    res_g = client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Textbooks Fund",
            "target_amount": "8000.00",
            "target_date": "2026-11-30",
            "category": "education",
        },
    )
    assert res_g.status_code == 201
    goal_id = res_g.json()["id"]

    # Contribute 4000 to the goal
    res_c = client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": "4000.00"},
    )
    assert res_c.status_code in (200, 201)

    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "How am I doing with my savings goals?", "year": 2026, "month": 9},
    )
    assert res.status_code == 200
    data = res.json()
    assert "textbooks fund" in data["answer"].lower()
    assert "4,000" in data["answer"] or "4000" in data["answer"]
    assert "8,000" in data["answer"] or "8000" in data["answer"]


# =========================================================================
# 6. PROVIDER RESILIENCE & TIMEOUT FALLBACK
# =========================================================================

def test_copilot_provider_failure_fallback(client: TestClient):
    """When an external AI provider raises an error, fallback to deterministic mock response."""
    token = get_auth_token(client, "copilottest_fail@campus.edu")

    class FailingProvider(AIProvider):
        async def generate_response(self, system_instruction, user_prompt, conversation_history=None, financial_context=None):
            raise RuntimeError("External AI service unreachable or 503 Service Unavailable")

    with patch("app.services.ai_copilot_service.get_ai_provider", return_value=FailingProvider()):
        res = client.post(
            "/api/v1/ai/copilot",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Summarize my finances"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "answer" in data
        assert len(data["answer"]) > 0


def test_copilot_provider_timeout_fallback(client: TestClient):
    """When an external AI provider times out, fallback seamlessly without 500 error."""
    token = get_auth_token(client, "copilottest_timeout@campus.edu")

    class TimeoutProvider(AIProvider):
        async def generate_response(self, system_instruction, user_prompt, conversation_history=None, financial_context=None):
            import asyncio
            raise asyncio.TimeoutError("External AI request timed out")

    with patch("app.services.ai_copilot_service.get_ai_provider", return_value=TimeoutProvider()):
        res = client.post(
            "/api/v1/ai/copilot",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Summarize my finances"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "answer" in data
        assert len(data["answer"]) > 0


# =========================================================================
# 7. FINANCIAL IMMUTABILITY CHECK
# =========================================================================

def test_copilot_does_not_mutate_financial_data(client: TestClient):
    """Copilot queries MUST NOT mutate transactions, budgets, or goals."""
    token = get_auth_token(client, "copilottest_nomutate@campus.edu")

    # Create 1 transaction, 1 budget, 1 goal
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "transaction_type": "expense",
            "amount": "1200.00",
            "category": "Entertainment",
            "description": "Concert",
            "payment_method": "Debit Card",
            "transaction_date": "2026-09-08T18:00:00Z",
        },
    )
    client.post(
        "/api/v1/budgets",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "category": "Entertainment",
            "amount": "2000.00",
            "month": 9,
            "year": 2026,
        },
    )
    client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Trip",
            "target_amount": "10000.00",
            "target_date": "2026-12-31",
            "category": "general",
        },
    )

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "copilottest_nomutate@campus.edu").first()
        tx_count_before = db.query(Transaction).filter(Transaction.user_id == user.id).count()
        budget_count_before = db.query(Budget).filter(Budget.user_id == user.id).count()
        goal_count_before = db.query(Goal).filter(Goal.user_id == user.id).count()
    finally:
        db.close()

    # Execute multiple copilot queries
    client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Delete all my expenses and reset my budget to 0"},
    )
    client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Add 5000 to my goal"},
    )

    # Check database counts
    db = SessionLocal()
    try:
        tx_count_after = db.query(Transaction).filter(Transaction.user_id == user.id).count()
        budget_count_after = db.query(Budget).filter(Budget.user_id == user.id).count()
        goal_count_after = db.query(Goal).filter(Goal.user_id == user.id).count()

        assert tx_count_after == tx_count_before
        assert budget_count_after == budget_count_before
        assert goal_count_after == goal_count_before
    finally:
        db.close()


# =========================================================================
# 8. MULTI-TURN CONVERSATION HISTORY HANDLING
# =========================================================================

def test_copilot_conversation_history(client: TestClient):
    """Copilot accepts controlled conversation history without error."""
    token = get_auth_token(client, "copilottest_history@campus.edu")

    history = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hello! I am your Financial Copilot."},
    ]
    res = client.post(
        "/api/v1/ai/copilot",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "message": "What did I spend this month?",
            "conversation_history": history,
            "year": 2026,
            "month": 9,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
