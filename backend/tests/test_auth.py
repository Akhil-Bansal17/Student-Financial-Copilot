import pytest
from fastapi.testclient import TestClient
from app.db.session import SessionLocal
from app.models.user import User


@pytest.fixture(autouse=True)
def cleanup_test_users():
    """Ensure test users are cleaned up before and after each test."""
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%test%@campus.edu")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_register_valid_user(client: TestClient):
    """1. Test successful user registration."""
    payload = {
        "email": "student.test1@campus.edu",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "full_name": "Test Student 1",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "student.test1@campus.edu"
    assert data["user"]["full_name"] == "Test Student 1"
    assert "id" in data["user"]


def test_password_is_stored_as_hash(client: TestClient):
    """2. Test password is saved as a bcrypt hash, not plaintext."""
    email = "hash.test@campus.edu"
    plain_password = "SecretPassword99!"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": plain_password,
            "confirm_password": plain_password,
            "full_name": "Hash Verifier",
        },
    )

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.password_hash != plain_password
        assert user.password_hash.startswith("$2b$") or user.password_hash.startswith("$2a$")
    finally:
        db.close()


def test_password_hash_never_exposed(client: TestClient):
    """3. Test password hash is never present in any API response."""
    payload = {
        "email": "noexpose.test@campus.edu",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    # Test register response
    reg_resp = client.post("/api/v1/auth/register", json=payload)
    assert "password_hash" not in reg_resp.text
    assert "password" not in reg_resp.json()["user"]

    token = reg_resp.json()["access_token"]

    # Test login response
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert "password_hash" not in login_resp.text
    assert "password" not in login_resp.json()["user"]

    # Test /me response
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert "password_hash" not in me_resp.text
    assert "password" not in me_resp.json()


def test_register_duplicate_email_rejected(client: TestClient):
    """4. Test registering with an existing email returns 400."""
    payload = {
        "email": "duplicate.test@campus.edu",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    first_resp = client.post("/api/v1/auth/register", json=payload)
    assert first_resp.status_code == 201

    # Attempt registration with uppercase variant to verify normalization
    dup_payload = {
        "email": "DUPLICATE.TEST@campus.edu",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    dup_resp = client.post("/api/v1/auth/register", json=dup_payload)
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"].lower()


def test_register_password_mismatch_rejected(client: TestClient):
    """5. Test password confirmation mismatch is rejected with 422."""
    payload = {
        "email": "mismatch.test@campus.edu",
        "password": "Password123!",
        "confirm_password": "DifferentPassword456!",
    }
    resp = client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 422


def test_register_short_password_rejected(client: TestClient):
    """6. Test password shorter than 8 characters is rejected with 422."""
    payload = {
        "email": "short.test@campus.edu",
        "password": "short",
        "confirm_password": "short",
    }
    resp = client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 422


def test_login_success(client: TestClient):
    """7. Test login with correct credentials returns 200 and access token."""
    email = "login.test@campus.edu"
    password = "CorrectPassword123!"

    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "confirm_password": password},
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email


def test_login_invalid_password_rejected(client: TestClient):
    """8. Test login with wrong password returns 401."""
    email = "wrongpw.test@campus.edu"
    password = "CorrectPassword123!"

    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "confirm_password": password},
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword999!"},
    )
    assert login_resp.status_code == 401
    assert "Invalid email or password" in login_resp.json()["detail"]


def test_get_me_authenticated(client: TestClient):
    """9. Test GET /auth/me returns current user profile when valid token provided."""
    email = "getme.test@campus.edu"
    password = "Password123!"
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "confirm_password": password, "full_name": "Get Me Student"},
    )
    token = reg_resp.json()["access_token"]

    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    user_data = me_resp.json()
    assert user_data["email"] == email
    assert user_data["full_name"] == "Get Me Student"


def test_get_me_unauthenticated_rejected(client: TestClient):
    """10. Test GET /auth/me returns 401 when token is missing or invalid."""
    # No token
    no_auth_resp = client.get("/api/v1/auth/me")
    assert no_auth_resp.status_code == 401

    # Invalid token
    bad_token_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.fake.token"},
    )
    assert bad_token_resp.status_code == 401


def test_user_isolation(client: TestClient):
    """11. Test that User A and User B have separate identities and tokens."""
    user_a = {
        "email": "usera.test@campus.edu",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "full_name": "Student Alpha",
    }
    user_b = {
        "email": "userb.test@campus.edu",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "full_name": "Student Beta",
    }

    token_a = client.post("/api/v1/auth/register", json=user_a).json()["access_token"]
    token_b = client.post("/api/v1/auth/register", json=user_b).json()["access_token"]

    me_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    me_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()

    assert me_a["id"] != me_b["id"]
    assert me_a["email"] == user_a["email"]
    assert me_b["email"] == user_b["email"]
