import asyncio
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.routers import runs, site_audit
from app.schemas.engine_run import EngineRunCreate
from app.schemas.site_audit import SiteAuditStartRequest


def test_trigger_run_handler_enforces_rate_limit(fake_redis, monkeypatch):
    project_id = uuid4()
    tenant_id = uuid4()

    async def _noop_verify_project(*_args, **_kwargs):
        return SimpleNamespace(id=project_id)

    monkeypatch.setattr(runs, "_verify_project", _noop_verify_project)

    body = EngineRunCreate(
        query_set_id=uuid4(),
        engine_id=uuid4(),
        sample_count=1,
    )
    user = SimpleNamespace(tenant_id=tenant_id)

    async def run_test():
        for _ in range(runs._RUN_TRIGGER_LIMIT):
            await runs._enforce_run_trigger_rate(fake_redis, tenant_id)

        try:
            await runs.trigger_run(
                project_id=project_id,
                body=body,
                db=SimpleNamespace(),
                redis=fake_redis,
                user=user,
            )
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 429
            assert exc.detail["code"] == "runs.rate_limited"

    asyncio.run(run_test())


def test_site_audit_handler_enforces_rate_limit(fake_redis, monkeypatch):
    project_id = uuid4()
    tenant_id = uuid4()

    async def _noop_verify_project(*_args, **_kwargs):
        return SimpleNamespace(id=project_id)

    monkeypatch.setattr(site_audit, "_verify_project", _noop_verify_project)

    body = SiteAuditStartRequest(url="https://example.com")
    user = SimpleNamespace(tenant_id=tenant_id)

    async def run_test():
        for _ in range(site_audit._SITE_AUDIT_TRIGGER_LIMIT):
            await site_audit._enforce_site_audit_rate(fake_redis, tenant_id)

        try:
            await site_audit.start_site_audit(
                project_id=project_id,
                body=body,
                db=SimpleNamespace(),
                redis=fake_redis,
                user=user,
            )
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 429
            assert exc.detail["code"] == "site_audit.rate_limited"

    asyncio.run(run_test())
