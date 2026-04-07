import asyncio
import json
from datetime import datetime
from uuid import uuid4

from app.models.report import Report
from app.routers import public
from app.routers import reports as report_routes
from app.schemas.report import PublicReportResponse


def test_report_detail_route_returns_structured_payload(monkeypatch):
    report_id = uuid4()
    project_id = uuid4()
    tenant_id = uuid4()

    class DummyReportService:
        def __init__(self, db):
            self.db = db

        async def get_report(self, requested_report_id, requested_tenant_id):
            assert requested_report_id == report_id
            assert requested_tenant_id == tenant_id
            return Report(
                id=report_id,
                title="Visibility Audit",
                report_type="visibility_audit",
                project_id=project_id,
                created_at=datetime(2026, 4, 1, 12, 0, 0),
                data_json={
                    "report_type": "visibility_audit",
                    "summary": {"score_count": 4},
                },
            )

    class DummyUser:
        pass

    DummyUser.tenant_id = tenant_id

    monkeypatch.setattr(report_routes, "ReportService", DummyReportService)

    async def run_test():
        return await report_routes.get_report(
            report_id=report_id,
            db=None,
            user=DummyUser(),
        )

    response = asyncio.run(run_test())

    assert response.id == report_id
    assert response.title == "Visibility Audit"
    assert response.data == {
        "report_type": "visibility_audit",
        "summary": {"score_count": 4},
    }


def test_public_shared_report_route_returns_payload_with_headers(monkeypatch):
    class DummyReportService:
        def __init__(self, db):
            self.db = db

        async def get_shared_report(self, share_token):
            assert share_token == "share-token"
            return PublicReportResponse(
                title="Visibility Audit",
                report_type="visibility_audit",
                created_at=datetime(2026, 4, 1, 12, 0, 0),
                data={"summary": {"score_count": 4}},
            )

    monkeypatch.setattr(public, "ReportService", DummyReportService)

    async def run_test():
        return await public.get_shared_report(
            share_token="share-token",
            db=None,
        )

    response = asyncio.run(run_test())
    payload = json.loads(response.body)

    assert response.headers["Access-Control-Allow-Origin"] == "*"
    assert response.headers["Cache-Control"] == "public, max-age=60"
    assert payload["title"] == "Visibility Audit"
    assert payload["data"]["summary"]["score_count"] == 4
