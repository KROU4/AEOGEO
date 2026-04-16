import asyncio

from fastapi import HTTPException

from app.routers import runs
from app.routers import site_audit


def test_trigger_run_rate_limit_enforced(fake_redis, random_tenant_id):
    async def run_test():
        for _ in range(runs._RUN_TRIGGER_LIMIT):
            await runs._enforce_run_trigger_rate(fake_redis, random_tenant_id)

        try:
            await runs._enforce_run_trigger_rate(fake_redis, random_tenant_id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 429
            assert exc.detail["code"] == "runs.rate_limited"

    asyncio.run(run_test())


def test_site_audit_rate_limit_enforced(fake_redis, random_tenant_id):
    async def run_test():
        for _ in range(site_audit._SITE_AUDIT_TRIGGER_LIMIT):
            await site_audit._enforce_site_audit_rate(fake_redis, random_tenant_id)

        try:
            await site_audit._enforce_site_audit_rate(fake_redis, random_tenant_id)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 429
            assert exc.detail["code"] == "site_audit.rate_limited"

    asyncio.run(run_test())
