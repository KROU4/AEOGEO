from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.dependencies import get_redis, get_settings
from app.main import app


class FakeRedis:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def set(self, key: str, value: str) -> bool:
        self._store[key] = value
        return True


def test_referral_track_saves_signup_event():
    redis = FakeRedis()
    app.dependency_overrides[get_redis] = lambda: redis
    app.dependency_overrides[get_settings] = lambda: SimpleNamespace(
        referral_track_webhook_url="",
    )
    client = TestClient(app)

    try:
        response = client.post(
            "/api/v1/referral/track",
            json={
                "email": "new@example.com",
                "provider": "tolt",
                "referral_code": "ref_123",
            },
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert "referral:signup:tolt:new@example.com" in redis._store
        assert "ref_123" in redis._store["referral:signup:tolt:new@example.com"]
    finally:
        app.dependency_overrides.clear()
