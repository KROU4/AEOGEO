"""Temporal workflow: run a full GEO site audit for a given URL."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta

from temporalio import activity, workflow

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Input / Output dataclasses
# ---------------------------------------------------------------------------


@dataclass
class SiteAuditInput:
    audit_id: str
    url: str


@dataclass
class SiteAuditOutput:
    audit_id: str
    status: str
    geo_score: float
    error: str = ""


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------


@activity.defn
async def run_site_audit_activity(input: SiteAuditInput) -> SiteAuditOutput:
    """Execute the full GEO audit and persist results to the DB."""
    import uuid

    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import Settings
    from app.models.site_audit import SiteAudit

    settings = Settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    audit_uuid = uuid.UUID(input.audit_id)

    async with session_factory() as session:
        audit = await session.get(SiteAudit, audit_uuid)
        if audit is None:
            await engine.dispose()
            return SiteAuditOutput(
                audit_id=input.audit_id,
                status="failed",
                geo_score=0.0,
                error=f"SiteAudit {input.audit_id} not found in database",
            )

        audit.status = "running"
        await session.commit()

    try:
        from geo_audit.full_audit import run_full_audit

        openai_key: str | None = getattr(settings, "openai_api_key", None)
        result = await run_full_audit(input.url, openai_api_key=openai_key)

        geo_score = float(result.overall_geo_score)
        result_dict = result.model_dump()

        async with session_factory() as session:
            audit = await session.get(SiteAudit, audit_uuid)
            if audit is not None:
                audit.status = "completed"
                audit.overall_geo_score = geo_score
                audit.result_json = result_dict
                await session.commit()

        return SiteAuditOutput(
            audit_id=input.audit_id,
            status="completed",
            geo_score=geo_score,
        )

    except Exception as exc:
        error_msg = str(exc)
        logger.exception(
            "SiteAuditWorkflow activity failed for audit %s: %s",
            input.audit_id,
            error_msg,
        )
        async with session_factory() as session:
            audit = await session.get(SiteAudit, audit_uuid)
            if audit is not None:
                audit.status = "failed"
                audit.error_message = error_msg
                await session.commit()

        return SiteAuditOutput(
            audit_id=input.audit_id,
            status="failed",
            geo_score=0.0,
            error=error_msg,
        )
    finally:
        await engine.dispose()


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------


@workflow.defn
class SiteAuditWorkflow:
    """Orchestrate the full GEO site audit pipeline."""

    @workflow.run
    async def run(self, input: SiteAuditInput) -> SiteAuditOutput:
        workflow.logger.info(
            "SiteAuditWorkflow started for audit=%s url=%s",
            input.audit_id,
            input.url,
        )

        result = await workflow.execute_activity(
            run_site_audit_activity,
            input,
            start_to_close_timeout=timedelta(minutes=10),
        )

        workflow.logger.info(
            "SiteAuditWorkflow finished for audit=%s status=%s score=%.2f",
            result.audit_id,
            result.status,
            result.geo_score,
        )
        return result
