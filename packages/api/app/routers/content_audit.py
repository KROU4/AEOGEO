from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.content_audit import (
    ContentAuditEventResponse,
    ContentAuditSummaryResponse,
    ContentAuditTriggerRequest,
)
from app.services.content_audit import ContentAuditService

router = APIRouter(tags=["content-audit"])


async def _start_content_audit_workflow(event_id: UUID, delay_hours: int) -> str:
    from temporalio.client import Client as TemporalClient

    temporal_host = "temporal:7233"
    temporal_client = await TemporalClient.connect(temporal_host)
    workflow_id = f"content-audit-{event_id}"
    await temporal_client.start_workflow(
        "ContentAuditWorkflow",
        {
            "event_id": str(event_id),
            "delay_seconds": max(0, delay_hours) * 3600,
        },
        id=workflow_id,
        task_queue="aeogeo-pipeline",
    )
    return workflow_id


@router.post(
    "/projects/{project_id}/content-audit/trigger",
    response_model=ContentAuditEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_content_audit(
    project_id: UUID,
    body: ContentAuditTriggerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentAuditEventResponse:
    svc = ContentAuditService(db)
    mode = body.mode

    try:
        event = await svc.create_push_event(
            project_id=project_id,
            tenant_id=user.tenant_id,
            user_id=user.id,
            content_title=body.content_title,
            content_url=body.content_url,
            published_at=body.published_at,
            delay_hours=body.delay_hours,
            status="scheduled" if mode == "scheduled" else "pending",
        )
    except ValueError as exc:
        if str(exc) == "project_not_found":
            raise HTTPException(status_code=404, detail="Project not found") from exc
        raise

    if mode == "manual":
        event = await svc.execute_event_audit(
            event_id=event.id,
            expected_tenant_id=user.tenant_id,
        )
        return ContentAuditEventResponse.model_validate(event)

    try:
        workflow_id = await _start_content_audit_workflow(event.id, body.delay_hours)
    except Exception as exc:
        event.status = "pending"
        event.error_message = f"Failed to schedule delayed audit: {exc}"
        await db.commit()
        await db.refresh(event)
        return ContentAuditEventResponse.model_validate(event)

    event.temporal_workflow_id = workflow_id
    await db.commit()
    await db.refresh(event)
    return ContentAuditEventResponse.model_validate(event)


@router.get(
    "/projects/{project_id}/content-audit/attribution",
    response_model=list[ContentAuditEventResponse],
)
async def list_content_audit_attribution(
    project_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ContentAuditEventResponse]:
    svc = ContentAuditService(db)
    try:
        items = await svc.list_events(
            project_id=project_id,
            tenant_id=user.tenant_id,
            limit=limit,
        )
    except ValueError as exc:
        if str(exc) == "project_not_found":
            raise HTTPException(status_code=404, detail="Project not found") from exc
        raise
    return [ContentAuditEventResponse.model_validate(item) for item in items]


@router.get(
    "/projects/{project_id}/content-audit/attribution/summary",
    response_model=ContentAuditSummaryResponse,
)
async def get_content_audit_attribution_summary(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContentAuditSummaryResponse:
    svc = ContentAuditService(db)
    try:
        summary = await svc.summary(project_id=project_id, tenant_id=user.tenant_id)
    except ValueError as exc:
        if str(exc) == "project_not_found":
            raise HTTPException(status_code=404, detail="Project not found") from exc
        raise
    return ContentAuditSummaryResponse.model_validate(summary)
