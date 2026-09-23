import pytest
from fastapi.testclient import TestClient
from app.db.session import SessionLocal
from app.models.user import User
from app.models.financial_profile import FinancialProfile


@pytest.fixture(autouse=True)
def cleanup_profile_test_users():
    """Clean up test users and profiles before and after each test."""
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%profiletest%@campus.edu")).delete(
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


def test_create_and_update_financial_profile(client: TestClient):
    """1. Authenticated user can create and update financial profile draft."""
    token = get_auth_token(client, "profiletest1@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Initial profile not found
    resp = client.get("/api/v1/profile/financial", headers=headers)
    assert resp.status_code == 404

    # Create/update profile via PATCH
    update_payload = {
        "starting_balance": "2500.50",
        "money_sources": ["Pocket Money", "Family Support"],
        "financial_focus": ["Track my spending", "Save more money"],
    }
    patch_resp = client.patch(
        "/api/v1/profile/financial", json=update_payload, headers=headers
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert float(data["starting_balance"]) == 2500.50
    assert "Pocket Money" in data["money_sources"]
    assert "Family Support" in data["money_sources"]
    assert "Track my spending" in data["financial_focus"]
    assert data["onboarding_completed"] is False

    # Verify GET now returns the profile
    get_resp = client.get("/api/v1/profile/financial", headers=headers)
    assert get_resp.status_code == 200
    assert float(get_resp.json()["starting_balance"]) == 2500.50


def test_unauthenticated_cannot_access_profile(client: TestClient):
    """2. Unauthenticated user cannot access or modify financial profile."""
    # GET without token
    resp_get = client.get("/api/v1/profile/financial")
    assert resp_get.status_code == 401

    # PATCH without token
    resp_patch = client.patch(
        "/api/v1/profile/financial", json={"starting_balance": 100}
    )
    assert resp_patch.status_code == 401

    # Complete without token
    resp_complete = client.post("/api/v1/profile/onboarding/complete")
    assert resp_complete.status_code == 401


def test_user_cannot_access_another_users_profile(client: TestClient):
    """3. User cannot access or overwrite another user's financial profile."""
    token_a = get_auth_token(client, "profiletest_a@campus.edu", "Student A")
    token_b = get_auth_token(client, "profiletest_b@campus.edu", "Student B")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates profile with 5000 balance
    client.patch(
        "/api/v1/profile/financial",
        json={"starting_balance": 5000, "money_sources": ["Salary"]},
        headers=headers_a,
    )

    # User B creates profile with 100 balance
    client.patch(
        "/api/v1/profile/financial",
        json={"starting_balance": 100, "money_sources": ["Scholarship"]},
        headers=headers_b,
    )

    # User A reads profile -> receives 5000, not User B's 100
    res_a = client.get("/api/v1/profile/financial", headers=headers_a)
    assert res_a.status_code == 200
    assert float(res_a.json()["starting_balance"]) == 5000.00
    assert res_a.json()["money_sources"] == ["Salary"]

    # User B reads profile -> receives 100, not User A's 5000
    res_b = client.get("/api/v1/profile/financial", headers=headers_b)
    assert res_b.status_code == 200
    assert float(res_b.json()["starting_balance"]) == 100.00
    assert res_b.json()["money_sources"] == ["Scholarship"]


def test_starting_balance_accepts_zero(client: TestClient):
    """4. Starting balance accepts zero (₹0)."""
    token = get_auth_token(client, "profiletest_zero@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    patch_resp = client.patch(
        "/api/v1/profile/financial",
        json={"starting_balance": 0, "money_sources": ["Other"]},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert float(patch_resp.json()["starting_balance"]) == 0.00


def test_negative_starting_balance_rejected(client: TestClient):
    """5. Negative starting balance is rejected."""
    token = get_auth_token(client, "profiletest_neg@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    patch_resp = client.patch(
        "/api/v1/profile/financial",
        json={"starting_balance": -150.00},
        headers=headers,
    )
    assert patch_resp.status_code == 422


def test_decimal_values_handled_correctly(client: TestClient):
    """6. Decimal values are handled without floating point inaccuracy."""
    token = get_auth_token(client, "profiletest_decimal@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    patch_resp = client.patch(
        "/api/v1/profile/financial",
        json={"starting_balance": "1499.99", "money_sources": ["Freelance"]},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert str(patch_resp.json()["starting_balance"]) == "1499.99"


def test_invalid_money_source_rejected(client: TestClient):
    """7. Invalid money source values are rejected."""
    token = get_auth_token(client, "profiletest_invsrc@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    patch_resp = client.patch(
        "/api/v1/profile/financial",
        json={"money_sources": ["CryptoTrading", "Salary"]},
        headers=headers,
    )
    assert patch_resp.status_code == 422


def test_invalid_focus_rejected(client: TestClient):
    """8. Invalid focus values are rejected."""
    token = get_auth_token(client, "profiletest_invfocus@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    patch_resp = client.patch(
        "/api/v1/profile/financial",
        json={"financial_focus": ["Gambling", "Save more money"]},
        headers=headers,
    )
    assert patch_resp.status_code == 422


def test_onboarding_completion_stored(client: TestClient):
    """9. Onboarding completion is stored when required info is provided."""
    token = get_auth_token(client, "profiletest_complete@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt completion without required data -> fails 400
    fail_resp = client.post(
        "/api/v1/profile/onboarding/complete",
        json={"starting_balance": 0, "money_sources": []},
        headers=headers,
    )
    assert fail_resp.status_code == 400

    # Complete with valid starting balance and money sources
    complete_resp = client.post(
        "/api/v1/profile/onboarding/complete",
        json={
            "starting_balance": "1250.00",
            "money_sources": ["Pocket Money"],
            "financial_focus": ["Track my spending"],
        },
        headers=headers,
    )
    assert complete_resp.status_code == 200
    data = complete_resp.json()
    assert data["onboarding_completed"] is True
    assert float(data["starting_balance"]) == 1250.00

    # Verify /auth/me now reflects onboarding_completed == True
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["onboarding_completed"] is True


def test_existing_completed_user_does_not_need_onboarding_again(client: TestClient):
    """10. Existing completed user stays marked as completed across requests."""
    token = get_auth_token(client, "profiletest_repeat@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Complete onboarding
    client.post(
        "/api/v1/profile/onboarding/complete",
        json={
            "starting_balance": 500,
            "money_sources": ["Family Support"],
        },
        headers=headers,
    )

    # Verify on /auth/me
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["onboarding_completed"] is True

    # Re-reading profile confirms completed
    profile_resp = client.get("/api/v1/profile/financial", headers=headers)
    assert profile_resp.status_code == 200
    assert profile_resp.json()["onboarding_completed"] is True
