import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.models.user import User
from app.models.goal import Goal, GoalContribution


@pytest.fixture(autouse=True)
def cleanup_goal_test_users():
    """Clean up test users, goals, and contributions before and after each test."""
    yield
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.like("%goaltest%@campus.edu")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def get_auth_token(client: TestClient, email: str, name: str = "Goal Student") -> str:
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

def test_goals_unauthenticated_access_rejected(client: TestClient):
    """Unauthenticated requests to goal endpoints are strictly rejected with 401."""
    assert client.post("/api/v1/goals", json={}).status_code == 401
    assert client.get("/api/v1/goals").status_code == 401
    assert client.get("/api/v1/goals/overview").status_code == 401
    assert client.get("/api/v1/goals/1").status_code == 401
    assert client.patch("/api/v1/goals/1", json={}).status_code == 401
    assert client.delete("/api/v1/goals/1").status_code == 401
    assert client.post("/api/v1/goals/1/contribute", json={"amount": "100.00"}).status_code == 401
    assert client.get("/api/v1/goals/1/contributions").status_code == 401
    assert client.delete("/api/v1/goals/1/contributions/1").status_code == 401


def test_goal_ownership_isolation(client: TestClient):
    """User A cannot view, update, delete, or contribute to User B's goals."""
    token_a = get_auth_token(client, "goaltest_user_a@campus.edu", "Student A")
    token_b = get_auth_token(client, "goaltest_user_b@campus.edu", "Student B")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a goal
    create_res = client.post(
        "/api/v1/goals",
        headers=headers_a,
        json={"name": "Gaming PC", "target_amount": "50000.00"},
    )
    assert create_res.status_code == 201
    goal_id = create_res.json()["id"]

    # User B cannot get User A's goal
    assert client.get(f"/api/v1/goals/{goal_id}", headers=headers_b).status_code == 404

    # User B cannot update User A's goal
    assert client.patch(
        f"/api/v1/goals/{goal_id}",
        headers=headers_b,
        json={"name": "Hacked PC"},
    ).status_code == 404

    # User B cannot delete User A's goal
    assert client.delete(f"/api/v1/goals/{goal_id}", headers=headers_b).status_code == 404

    # User B cannot contribute to User A's goal
    assert client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        headers=headers_b,
        json={"amount": "1000.00"},
    ).status_code == 404

    # User B's list does not show User A's goals
    list_res = client.get("/api/v1/goals", headers=headers_b)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 0


# =========================================================================
# 2. VALIDATION & CREATION
# =========================================================================

def test_create_goal_validations(client: TestClient):
    """Validates required name, positive target amount, non-empty text, valid date."""
    token = get_auth_token(client, "goaltest_val@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Empty name
    assert client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "   ", "target_amount": "1000.00"},
    ).status_code == 422

    # Zero target amount
    assert client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Books", "target_amount": "0.00"},
    ).status_code == 422

    # Negative target amount
    assert client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Books", "target_amount": "-500.00"},
    ).status_code == 422

    # Valid goal with optional target date
    future_date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=90)).strftime("%Y-%m-%d")
    res = client.post(
        "/api/v1/goals",
        headers=headers,
        json={
            "name": "New Laptop",
            "description": "M3 MacBook Air for coding",
            "target_amount": "80000.00",
            "target_date": future_date,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "New Laptop"
    assert data["target_amount"] == "80000.00"
    assert data["current_amount"] == "0.00"
    assert data["remaining_amount"] == "80000.00"
    assert data["progress_percentage"] == "0.0"
    assert data["status"] == "active"
    assert data["target_date"] == future_date


# =========================================================================
# 3. CRUD & UPDATE RESTRICTIONS
# =========================================================================

def test_goal_crud_lifecycle(client: TestClient):
    """Full lifecycle: create, get, update, delete."""
    token = get_auth_token(client, "goaltest_crud@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create
    res = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Camera", "target_amount": "30000.00"},
    )
    assert res.status_code == 201
    goal_id = res.json()["id"]

    # 2. Get by ID
    get_res = client.get(f"/api/v1/goals/{goal_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Camera"

    # 3. Update title and target amount
    patch_res = client.patch(
        f"/api/v1/goals/{goal_id}",
        headers=headers,
        json={"name": "Mirrorless Camera", "target_amount": "35000.00"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Mirrorless Camera"
    assert patch_res.json()["target_amount"] == "35000.00"
    assert patch_res.json()["remaining_amount"] == "35000.00"

    # 4. Delete
    del_res = client.delete(f"/api/v1/goals/{goal_id}", headers=headers)
    assert del_res.status_code == 200

    # 5. Verify 404
    assert client.get(f"/api/v1/goals/{goal_id}", headers=headers).status_code == 404


# =========================================================================
# 4. CONTRIBUTIONS, PROGRESS & OVERFUNDING PREVENTION
# =========================================================================

def test_goal_contributions_and_completion(client: TestClient):
    """
    Test contribution flow:
    - Target: ₹10,000
    - Contribute: ₹4,000 -> Saved: ₹4,000, Remaining: ₹6,000, Progress: 40.0%, Status: active
    - Overfunding rejected: Attempt ₹7,000 contribution when remaining is ₹6,000 -> 400 Bad Request
    - Contribute: ₹6,000 -> Saved: ₹10,000, Remaining: ₹0.00, Progress: 100.0%, Status: completed
    - Contributing to completed goal rejected -> 400 Bad Request
    - Reverse contribution of ₹6,000 -> Saved: ₹4,000, Status returns to active
    """
    token = get_auth_token(client, "goaltest_contrib@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Create goal of ₹10,000
    res = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Semester Trip", "target_amount": "10000.00"},
    )
    goal_id = res.json()["id"]

    # 1. First contribution: ₹4,000
    c1_res = client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        headers=headers,
        json={"amount": "4000.00", "note": "Monthly pocket money savings"},
    )
    assert c1_res.status_code == 200
    c1_data = c1_res.json()
    assert c1_data["current_amount"] == "4000.00"
    assert c1_data["remaining_amount"] == "6000.00"
    assert c1_data["progress_percentage"] == "40.0"
    assert c1_data["status"] == "active"

    # 2. Overfunding rejected: attempt ₹7,000
    over_res = client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        headers=headers,
        json={"amount": "7000.00"},
    )
    assert over_res.status_code == 400
    assert "exceeds remaining target" in over_res.json()["detail"]

    # 3. Exact completion contribution: ₹6,000
    c2_res = client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        headers=headers,
        json={"amount": "6000.00", "note": "Freelance stipend allocation"},
    )
    assert c2_res.status_code == 200
    c2_data = c2_res.json()
    assert c2_data["current_amount"] == "10000.00"
    assert c2_data["remaining_amount"] == "0.00"
    assert c2_data["progress_percentage"] == "100.0"
    assert c2_data["status"] == "completed"

    # 4. Contributing to completed goal rejected
    c3_res = client.post(
        f"/api/v1/goals/{goal_id}/contribute",
        headers=headers,
        json={"amount": "500.00"},
    )
    assert c3_res.status_code == 400
    assert "already fully funded" in c3_res.json()["detail"]

    # 5. Check contribution history
    hist_res = client.get(f"/api/v1/goals/{goal_id}/contributions", headers=headers)
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) == 2
    c2_id = history[0]["id"]  # latest contribution is ₹6,000

    # 6. Reverse / delete latest contribution (₹6,000)
    rev_res = client.delete(
        f"/api/v1/goals/{goal_id}/contributions/{c2_id}",
        headers=headers,
    )
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["current_amount"] == "4000.00"
    assert rev_data["remaining_amount"] == "6000.00"
    assert rev_data["progress_percentage"] == "40.0"
    assert rev_data["status"] == "active"


# =========================================================================
# 5. STATUS LOGIC (ACTIVE, OVERDUE, COMPLETED)
# =========================================================================

def test_goal_status_edge_cases(client: TestClient):
    """
    Status determination:
    - Target date in past + not funded -> overdue
    - Target date in past + fully funded -> completed (completed persists)
    - Target date today -> active (student has today to fund)
    - Future target date -> active
    """
    token = get_auth_token(client, "goaltest_status@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    today = datetime.datetime.now(datetime.timezone.utc).date()
    yesterday = (today - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")
    tomorrow = (today + datetime.timedelta(days=1)).strftime("%Y-%m-%d")

    # 1. Past target date with 0 savings -> overdue
    res_overdue = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Past Goal", "target_amount": "5000.00", "target_date": yesterday},
    )
    assert res_overdue.status_code == 201
    assert res_overdue.json()["status"] == "overdue"

    # 2. Target date today -> active
    res_today = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Today Goal", "target_amount": "5000.00", "target_date": today_str},
    )
    assert res_today.status_code == 201
    assert res_today.json()["status"] == "active"

    # 3. Future target date -> active
    res_future = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Future Goal", "target_amount": "5000.00", "target_date": tomorrow},
    )
    assert res_future.status_code == 201
    assert res_future.json()["status"] == "active"

    # 4. Fund the overdue goal to 100% -> must transition to 'completed'
    past_id = res_overdue.json()["id"]
    fund_res = client.post(
        f"/api/v1/goals/{past_id}/contribute",
        headers=headers,
        json={"amount": "5000.00"},
    )
    assert fund_res.status_code == 200
    assert fund_res.json()["status"] == "completed"


# =========================================================================
# 6. OVERVIEW AGGREGATION & EMPTY STATES
# =========================================================================

def test_goals_overview_and_filtering(client: TestClient):
    """Test /api/v1/goals/overview and status filtering."""
    token = get_auth_token(client, "goaltest_ov@campus.edu")
    headers = {"Authorization": f"Bearer {token}"}

    # Initial empty state
    empty_ov = client.get("/api/v1/goals/overview", headers=headers).json()
    assert empty_ov["total_goals_count"] == 0
    assert empty_ov["total_target_amount"] == "0.00"
    assert empty_ov["total_saved_amount"] == "0.00"
    assert empty_ov["overall_progress_percentage"] == "0.0"

    # Create Goal 1: ₹10,000 (contribute ₹10,000 -> completed)
    g1 = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Goal 1", "target_amount": "10000.00"},
    ).json()
    client.post(f"/api/v1/goals/{g1['id']}/contribute", headers=headers, json={"amount": "10000.00"})

    # Create Goal 2: ₹20,000 (contribute ₹5,000 -> active)
    g2 = client.post(
        "/api/v1/goals",
        headers=headers,
        json={"name": "Goal 2", "target_amount": "20000.00"},
    ).json()
    client.post(f"/api/v1/goals/{g2['id']}/contribute", headers=headers, json={"amount": "5000.00"})

    # Overview check: Total Target: ₹30,000, Total Saved: ₹15,000 -> 50.0%
    ov = client.get("/api/v1/goals/overview", headers=headers).json()
    assert ov["total_goals_count"] == 2
    assert ov["active_goals_count"] == 1
    assert ov["completed_goals_count"] == 1
    assert ov["total_target_amount"] == "30000.00"
    assert ov["total_saved_amount"] == "15000.00"
    assert ov["overall_progress_percentage"] == "50.0"

    # Filtering by status
    active_list = client.get("/api/v1/goals?status=active", headers=headers).json()
    assert len(active_list) == 1
    assert active_list[0]["id"] == g2["id"]

    completed_list = client.get("/api/v1/goals?status=completed", headers=headers).json()
    assert len(completed_list) == 1
    assert completed_list[0]["id"] == g1["id"]
