from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

import httpx
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.engine_run import EngineRun
from app.models.project import Project
from app.models.visibility_score import VisibilityScore


def _integration_key(tenant_id: str) -> str:
    return f"tenant:{tenant_id}:integrations"


async def dispatch_run_completed_event(
    db: AsyncSession,
    run_id: UUID,
) -> None:
    run_result = await db.execute(select(EngineRun).where(EngineRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if run is None:
        return

    score_result = await db.execute(
        select(func.avg(VisibilityScore.total_score)).where(VisibilityScore.run_id == run_id),
    )
    avg_score = score_result.scalar() or Decimal("0.00")

    project_result = await db.execute(
        select(Project.tenant_id).where(Project.id == run.project_id),
    )
    tenant_id = project_result.scalar_one_or_none()
    if tenant_id is None:
        return

    payload = {
        "event": "run.completed",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "run": {
            "id": str(run.id),
            "project_id": str(run.project_id),
            "query_set_id": str(run.query_set_id),
            "engine_id": str(run.engine_id),
            "status": run.status,
            "sample_count": run.sample_count,
            "triggered_by": run.triggered_by,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "avg_total_score": float(avg_score),
        },
    }

    settings = get_settings()
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        raw = await redis.get(_integration_key(str(tenant_id)))
        if not raw:
            return
        cfg = json.loads(raw)
    finally:
        await redis.close()

    generic_webhook = (cfg.get("generic_webhook_url") or "").strip()
    slack_webhook = (cfg.get("slack_webhook_url") or "").strip()
    slack_enabled = bool(cfg.get("slack_enabled"))

    async with httpx.AsyncClient(timeout=10) as client:
        if generic_webhook:
            await client.post(generic_webhook, json=payload)

        if slack_enabled and slack_webhook:
            await client.post(
                slack_webhook,
                json={
                    "text": (
                        "AEOGEO run completed\n"
                        f"project={run.project_id} run={run.id} "
                        f"status={run.status} avg_score={float(avg_score):.2f}"
                    )
                },
            )
