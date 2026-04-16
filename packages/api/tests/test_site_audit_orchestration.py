from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_current_user, get_db, get_redis
from app.main import app
from app.models.site_audit import SiteAudit
from app.routers import site_audit


class FakeRedis:
    async def eval(self, *_args, **_kwargs) -> int:
        return 1


class FakeScalarResult:
    def __init__(self, items: list[SiteAudit]) -> None:
        self._items = items

    def all(self) -> list[SiteAudit]:
        return self._items


class FakeResult:
    def __init__(self, items: list[SiteAudit]) -> None:
        self._items = items

    def scalar_one_or_none(self) -> SiteAudit | None:
        return self._items[0] if self._items else None

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._items)


class FakeDB:
    def __init__(self, audits: list[SiteAudit] | None = None) -> None:
        self.audits = audits or []
        self.commits = 0

    def add(self, audit: SiteAudit) -> None:
        self.audits.append(audit)

    async def flush(self) -> None:
        now = datetime.now(UTC)
        for audit in self.audits:
            if audit.id is None:
                audit.id = uuid4()
            if audit.created_at is None:
                audit.created_at = now

    async def refresh(self, audit: SiteAudit) -> None:
        if audit.id is None:
            audit.id = uuid4()
        if audit.created_at is None:
            audit.created_at = datetime.now(UTC)

    async def commit(self) -> None:
        self.commits += 1

    async def execute(self, *_args, **_kwargs) -> FakeResult:
        return FakeResult(self.audits)

    async def scalar(self, *_args, **_kwargs):
        return None


def _client(db: FakeDB, user: SimpleNamespace) -> TestClient:
    async def _db_override():
        return db

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = _db_override
    app.dependency_overrides[get_redis] = lambda: FakeRedis()
    return TestClient(app)


def test_temporal_start_failure_marks_audit_failed(monkeypatch) -> None:
    project_id = uuid4()
    user = SimpleNamespace(id=uuid4(), tenant_id=uuid4())
    db = FakeDB()

    async def _verify_project(*_args, **_kwargs):
        return SimpleNamespace(id=project_id)

    async def _fail_start(*_args, **_kwargs):
        raise RuntimeError("temporal unavailable")

    monkeypatch.setattr(site_audit, "_verify_project", _verify_project)
    monkeypatch.setattr(site_audit, "_start_site_audit_workflow", _fail_start)

    client = _client(db, user)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/site-audit",
            json={"url": "https://example.com"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "failed"
    assert "Temporal" in payload["error_message"]
    assert db.audits[0].status == "failed"


def test_latest_stale_audit_is_marked_failed(monkeypatch) -> None:
    project_id = uuid4()
    user = SimpleNamespace(id=uuid4(), tenant_id=uuid4())
    old_started_at = datetime.now(UTC) - timedelta(minutes=31)
    audit = SiteAudit(
        project_id=project_id,
        url="https://example.com",
        overall_geo_score=0,
        status="running",
        started_at=old_started_at,
    )
    audit.id = uuid4()
    audit.created_at = old_started_at
    db = FakeDB([audit])

    async def _verify_project(*_args, **_kwargs):
        return SimpleNamespace(id=project_id)

    monkeypatch.setattr(site_audit, "_verify_project", _verify_project)
    monkeypatch.setattr(
        site_audit,
        "get_settings",
        lambda: SimpleNamespace(site_audit_timeout_minutes=10),
    )

    client = _client(db, user)
    try:
        response = client.get(f"/api/v1/projects/{project_id}/site-audit/latest")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "failed"
    assert "timed out" in payload["error_message"]
    assert db.commits == 1
