from __future__ import annotations

import os
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_current_user, get_db, get_redis
from app.main import app
from app.routers import runs, site_audit


class FakeRedis:
    def __init__(self) -> None:
        self._counters: dict[str, int] = {}

    async def incr(self, key: str) -> int:
        self._counters[key] = self._counters.get(key, 0) + 1
        return self._counters[key]

    async def expire(self, _key: str, _seconds: int) -> bool:
        return True

    async def eval(self, _script: str, numkeys: int, *keys_and_args: str) -> int:
        if numkeys != 1:
            raise NotImplementedError("FakeRedis.eval supports numkeys=1 only")
        key = keys_and_args[0]
        window_sec = int(keys_and_args[1])
        count = await self.incr(key)
        if count == 1:
            await self.expire(key, window_sec)
        return count


def _build_client(*, user: SimpleNamespace, redis: FakeRedis) -> TestClient:
    os.environ.setdefault("DEBUG", "false")

    async def _dummy_db():
        return SimpleNamespace()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_redis] = lambda: redis
    app.dependency_overrides[get_db] = _dummy_db
    return TestClient(app)


def test_trigger_run_http_rate_limit(monkeypatch):
    project_id = uuid4()
    tenant_id = uuid4()
    redis = FakeRedis()
    user = SimpleNamespace(id=uuid4(), tenant_id=tenant_id)

    async def _noop_verify_project(*_args, **_kwargs):
        return SimpleNamespace(id=project_id)

    monkeypatch.setattr(runs, "_verify_project", _noop_verify_project)

    client = _build_client(user=user, redis=redis)
    try:
        redis._counters[f"runs:trigger:{tenant_id}"] = runs._RUN_TRIGGER_LIMIT

        response = client.post(
            f"/api/v1/projects/{project_id}/runs",
            json={
                "query_set_id": str(uuid4()),
                "engine_id": str(uuid4()),
                "sample_count": 1,
            },
        )

        assert response.status_code == 429
        assert response.json()["detail"]["code"] == "runs.rate_limited"
    finally:
        app.dependency_overrides.clear()


def test_site_audit_http_rate_limit(monkeypatch):
    project_id = uuid4()
    tenant_id = uuid4()
    redis = FakeRedis()
    user = SimpleNamespace(id=uuid4(), tenant_id=tenant_id)

    async def _noop_verify_project(*_args, **_kwargs):
        return SimpleNamespace(id=project_id)

    monkeypatch.setattr(site_audit, "_verify_project", _noop_verify_project)

    client = _build_client(user=user, redis=redis)
    try:
        redis._counters[f"site_audit:trigger:{tenant_id}"] = site_audit._SITE_AUDIT_TRIGGER_LIMIT

        response = client.post(
            f"/api/v1/projects/{project_id}/site-audit",
            json={"url": "https://example.com"},
        )

        assert response.status_code == 429
        assert response.json()["detail"]["code"] == "site_audit.rate_limited"
    finally:
        app.dependency_overrides.clear()
