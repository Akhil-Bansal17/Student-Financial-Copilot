from fastapi.testclient import TestClient


def test_health_check_endpoint(client: TestClient):
    """
    Test that GET /api/v1/health returns HTTP 200 and status: ok.
    """
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert "version" in data


def test_root_endpoint(client: TestClient):
    """
    Test that GET / returns HTTP 200 with basic API metadata.
    """
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Student Financial Copilot"
    assert data["health"] == "/api/v1/health"
