from fastapi.testclient import TestClient


def test_health_check_endpoint(client: TestClient):
    """
    Test that GET /api/v1/health returns HTTP 200, status: ok, and database: healthy.
    """
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "healthy"
    assert "environment" in data
    assert "version" in data


def test_readiness_probe_endpoint(client: TestClient):
    """
    Test that GET /api/v1/ready returns HTTP 200 and connected status.
    """
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["ready"] is True
    assert data["database"] == "connected"


def test_security_headers_present(client: TestClient):
    """
    Test that production enterprise security headers are attached to responses.
    """
    response = client.get("/api/v1/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_root_endpoint(client: TestClient):
    """
    Test that GET / returns HTTP 200 with basic API metadata.
    """
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Student Financial Copilot"
    assert data["health"] == "/api/v1/health"
