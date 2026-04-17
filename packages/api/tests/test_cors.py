from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

PROD_ORIGIN = "https://avop.up.railway.app"


def test_projects_preflight_allows_production_origin() -> None:
    client = TestClient(app)

    response = client.options(
        "/api/v1/projects/",
        headers={
            "Origin": PROD_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == PROD_ORIGIN
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_auth_me_preflight_allows_production_origin() -> None:
    client = TestClient(app)

    response = client.options(
        "/api/v1/auth/me",
        headers={
            "Origin": PROD_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == PROD_ORIGIN


def test_preflight_rejects_non_http_origin() -> None:
    """http(s) origins are broadly allowed; extension / file schemes are not."""
    client = TestClient(app)

    response = client.options(
        "/api/v1/projects/",
        headers={
            "Origin": "chrome-extension://abcdefghijklmnop",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_error_response_keeps_cors_headers_for_allowed_origin() -> None:
    client = TestClient(app)

    response = client.get("/api/v1/auth/me", headers={"Origin": PROD_ORIGIN})

    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == PROD_ORIGIN
