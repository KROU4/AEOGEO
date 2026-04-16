import os

from fastapi.testclient import TestClient


def test_metrics_endpoint_returns_prometheus_payload():
    os.environ.setdefault("DEBUG", "false")

    from app.main import app

    client = TestClient(app)
    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    body = response.text
    assert "aeogeo_http_requests_total" in body
    assert "aeogeo_process_uptime_seconds" in body


def test_health_endpoint_remains_available():
    os.environ.setdefault("DEBUG", "false")

    from app.main import app

    client = TestClient(app)
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
