"""Temporal workflow for delayed content audit attribution re-checks."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta

from temporalio import activity, workflow


@dataclass
class ContentAuditInput:
    event_id: str
    delay_seconds: int = 172800


@dataclass
class ContentAuditOutput:
    event_id: str
    status: str
    error: str = ""


@activity.defn
async def run_content_audit_activity(event_id: str) -> ContentAuditOutput:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.config import get_settings
    from app.services.content_audit import ContentAuditService

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    event_uuid = uuid.UUID(event_id)

    try:
        async with session_factory() as session:
            service = ContentAuditService(session)
            await service.execute_event_audit(event_id=event_uuid)
        return ContentAuditOutput(event_id=event_id, status="completed")
    except Exception as exc:
        return ContentAuditOutput(
            event_id=event_id,
            status="failed",
            error=str(exc),
        )
    finally:
        await engine.dispose()


@workflow.defn
class ContentAuditWorkflow:
    @workflow.run
    async def run(self, input: ContentAuditInput) -> ContentAuditOutput:
        if input.delay_seconds > 0:
            await workflow.sleep(timedelta(seconds=input.delay_seconds))

        return await workflow.execute_activity(
            run_content_audit_activity,
            input.event_id,
            start_to_close_timeout=timedelta(minutes=5),
        )
