from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.dependencies import get_current_user, get_db
from app.main import app
from app.routers import content_audit


def _build_event(project_id):
    return SimpleNamespace(
        id=uuid4(),
        project_id=project_id,
        triggered_by_user_id=uuid4(),
        content_title="Landing page",
        content_url="https://example.com/landing",
        published_at=datetime(2026, 4, 1, 9, 0, 0),
        recheck_at=datetime(2026, 4, 3, 9, 0, 0),
        status="completed",
        baseline_total_score=Decimal("3.25"),
        baseline_mentions=12,
        baseline_citations=4,
        checked_total_score=Decimal("5.10"),
        checked_mentions=21,
        checked_citations=9,
        delta_total_score=Decimal("1.85"),
        delta_mentions=9,
        delta_citations=5,
        temporal_workflow_id=None,
        error_message=None,
        created_at=datetime(2026, 4, 1, 9, 0, 0),
        updated_at=datetime(2026, 4, 3, 9, 0, 0),
    )


def test_content_audit_manual_trigger(monkeypatch):
    project_id = uuid4()
    user = SimpleNamespace(id=uuid4(), tenant_id=uuid4())
    event = _build_event(project_id)

    class FakeService:
        def __init__(self, *_args, **_kwargs):
            pass

        async def create_push_event(self, **_kwargs):
            return event

        async def execute_event_audit(self, **_kwargs):
            return event

    monkeypatch.setattr(content_audit, "ContentAuditService", FakeService)

    async def _dummy_db():
        return SimpleNamespace()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = _dummy_db
    client = TestClient(app)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/content-audit/trigger",
            json={"mode": "manual", "delay_hours": 0},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["status"] == "completed"
        assert payload["delta_total_score"] == 1.85
    finally:
        app.dependency_overrides.clear()


def test_content_audit_attribution_list_and_summary(monkeypatch):
    project_id = uuid4()
    user = SimpleNamespace(id=uuid4(), tenant_id=uuid4())
    event = _build_event(project_id)

    class FakeService:
        def __init__(self, *_args, **_kwargs):
            pass

        async def list_events(self, **_kwargs):
            return [event]

        async def summary(self, **_kwargs):
            return {
                "project_id": project_id,
                "total_events": 1,
                "completed_events": 1,
                "avg_delta_total_score": 1.85,
                "total_delta_mentions": 9,
                "total_delta_citations": 5,
            }

    monkeypatch.setattr(content_audit, "ContentAuditService", FakeService)

    async def _dummy_db():
        return SimpleNamespace()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = _dummy_db
    client = TestClient(app)
    try:
        list_response = client.get(
            f"/api/v1/projects/{project_id}/content-audit/attribution",
        )
        assert list_response.status_code == 200
        assert len(list_response.json()) == 1

        summary_response = client.get(
            f"/api/v1/projects/{project_id}/content-audit/attribution/summary",
        )
        assert summary_response.status_code == 200
        assert summary_response.json()["avg_delta_total_score"] == 1.85
    finally:
        app.dependency_overrides.clear()
