from __future__ import annotations

import os
from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_current_user, get_redis
from app.main import app


class FakeRedis:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._counters: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str) -> bool:
        self._store[key] = value
        return True

    async def incr(self, key: str) -> int:
        self._counters[key] = self._counters.get(key, 0) + 1
        return self._counters[key]

    async def expire(self, key: str, _seconds: int) -> bool:
        return True


class _User:
    def __init__(self) -> None:
        self.id = uuid4()
        self.tenant_id = uuid4()


def _build_client(redis: FakeRedis, user: _User) -> TestClient:
    os.environ.setdefault("DEBUG", "false")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_redis] = lambda: redis
    return TestClient(app)


def test_notification_preferences_http_roundtrip():
    redis = FakeRedis()
    user = _User()
    client = _build_client(redis, user)
    try:
        initial = client.get("/api/v1/auth/me/notifications")
        assert initial.status_code == 200
        assert initial.json() == {
            "weekly_reports": True,
            "citation_alerts": True,
            "competitor_movements": False,
            "content_published": True,
            "team_activity": False,
        }

        patched = client.patch(
            "/api/v1/auth/me/notifications",
            json={"weekly_reports": False, "team_activity": True},
        )
        assert patched.status_code == 200
        assert patched.json()["weekly_reports"] is False
        assert patched.json()["team_activity"] is True

        after = client.get("/api/v1/auth/me/notifications")
        assert after.status_code == 200
        assert after.json()["weekly_reports"] is False
        assert after.json()["team_activity"] is True
    finally:
        app.dependency_overrides.clear()


def test_integration_settings_http_roundtrip():
    redis = FakeRedis()
    user = _User()
    client = _build_client(redis, user)
    try:
        initial = client.get("/api/v1/settings/integrations")
        assert initial.status_code == 200
        assert initial.json() == {
            "generic_webhook_url": None,
            "slack_webhook_url": None,
            "slack_enabled": False,
        }

        patched = client.patch(
            "/api/v1/settings/integrations",
            json={
                "generic_webhook_url": "https://example.com/hooks/aeogeo",
                "slack_webhook_url": "https://hooks.slack.com/services/T/B/X",
                "slack_enabled": True,
            },
        )
        assert patched.status_code == 200
        assert patched.json()["slack_enabled"] is True
        assert patched.json()["generic_webhook_url"] == "https://example.com/hooks/aeogeo"

        after = client.get("/api/v1/settings/integrations")
        assert after.status_code == 200
        assert after.json()["slack_enabled"] is True
        assert after.json()["generic_webhook_url"] == "https://example.com/hooks/aeogeo"
    finally:
        app.dependency_overrides.clear()
