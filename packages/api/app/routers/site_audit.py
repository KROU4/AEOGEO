"""Site GEO audit router — start, list, and retrieve audits per project."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, StreamingResponse
from pydantic import HttpUrl, TypeAdapter, ValidationError
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db, get_redis
from app.models.brand import Brand
from app.models.project import Project
from app.models.site_audit import SiteAudit
from app.models.user import User
from app.schemas.site_audit import (
    SiteAuditListResponse,
    SiteAuditResponse,
    SiteAuditStartRequest,
)
from app.utils.rate_limit import enforce_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/site-audit", tags=["site-audit"])
_SITE_AUDIT_TRIGGER_LIMIT = 10
_SITE_AUDIT_WINDOW_SEC = 3600
_SITE_AUDIT_TIMEOUT_FALLBACK = timedelta(minutes=10)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _verify_project(
    project_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Project:
    """Return the project or raise 404."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.tenant_id == tenant_id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_audit(
    audit_id: UUID,
    project_id: UUID,
    db: AsyncSession,
) -> SiteAudit:
    """Return the site audit or raise 404."""
    result = await db.execute(
        select(SiteAudit).where(
            SiteAudit.id == audit_id,
            SiteAudit.project_id == project_id,
        )
    )
    audit = result.scalar_one_or_none()
    if audit is None:
        raise HTTPException(status_code=404, detail="Site audit not found")
    return audit


async def _start_site_audit_workflow(audit_id: UUID, url: str) -> str:
    """Start a Temporal SiteAuditWorkflow and return its workflow ID."""
    from temporalio.client import Client as TemporalClient

    temporal_client = await TemporalClient.connect(get_settings().temporal_host)
    workflow_id = f"site-audit-{audit_id}"
    await temporal_client.start_workflow(
        "SiteAuditWorkflow",
        {"audit_id": str(audit_id), "url": url},
        id=workflow_id,
        task_queue="aeogeo-pipeline",
    )
    return workflow_id


async def _enforce_site_audit_rate(redis: Redis, tenant_id: UUID) -> None:
    await enforce_rate_limit(
        redis,
        key=f"site_audit:trigger:{tenant_id}",
        limit=_SITE_AUDIT_TRIGGER_LIMIT,
        window_sec=_SITE_AUDIT_WINDOW_SEC,
        error_code="site_audit.rate_limited",
        message="Too many site audit launches. Try again later.",
    )


def _normalize_site_audit_url(url: str) -> str:
    try:
        return str(TypeAdapter(HttpUrl).validate_python(url))
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "site_audit.invalid_url",
                "message": "Invalid or unsupported URL.",
            },
        ) from exc


def _site_audit_timeout_window() -> timedelta:
    minutes = max(1, get_settings().site_audit_timeout_minutes)
    return timedelta(minutes=minutes)


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _is_stale_audit(audit: SiteAudit) -> bool:
    if audit.status not in {"pending", "running"}:
        return False
    started_at = audit.started_at or audit.created_at
    if started_at is None:
        return False
    timeout = _site_audit_timeout_window() or _SITE_AUDIT_TIMEOUT_FALLBACK
    return datetime.now(UTC) - _as_aware_utc(started_at) > timeout


async def _mark_stale_audits_failed(
    audits: list[SiteAudit],
    db: AsyncSession,
) -> None:
    touched = False
    timeout_minutes = max(1, get_settings().site_audit_timeout_minutes)
    for audit in audits:
        if not _is_stale_audit(audit):
            continue
        audit.status = "failed"
        audit.error_message = (
            f"Site audit timed out after {timeout_minutes} minutes. "
            "Check that the Temporal worker is running on task queue aeogeo-pipeline."
        )
        touched = True
    if touched:
        await db.commit()


# ---------------------------------------------------------------------------
# POST /projects/{project_id}/site-audit  — start a new audit
# ---------------------------------------------------------------------------


@router.post("", response_model=SiteAuditResponse, status_code=201)
async def start_site_audit(
    project_id: UUID,
    body: SiteAuditStartRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> SiteAuditResponse:
    await _verify_project(project_id, user.tenant_id, db)
    await _enforce_site_audit_rate(redis, user.tenant_id)

    url: str | None = str(body.url) if body.url else None
    if not url:
        brand = await db.scalar(select(Brand).where(Brand.project_id == project_id))
        url = brand.website if brand else None

    if not url:
        raise HTTPException(
            status_code=422,
            detail="No URL provided and no brand website configured for this project.",
        )

    url = _normalize_site_audit_url(url)

    started_at = datetime.now(UTC)
    audit = SiteAudit(
        project_id=project_id,
        url=url,
        status="pending",
        overall_geo_score=0,
        started_at=started_at,
    )
    db.add(audit)
    await db.flush()
    await db.refresh(audit)

    # Start Temporal workflow. If this fails, do not leave the frontend polling
    # a pending audit that can never be picked up by a worker.
    try:
        workflow_id = await _start_site_audit_workflow(audit.id, url)
        audit.temporal_workflow_id = workflow_id
    except Exception as exc:
        audit.status = "failed"
        audit.error_message = (
            "Failed to start Temporal SiteAuditWorkflow. "
            "Check TEMPORAL_HOST and the aeogeo-pipeline worker service."
        )
        logger.exception(
            "Failed to start Temporal SiteAuditWorkflow for audit %s: %s",
            audit.id,
            exc,
        )

    await db.commit()
    await db.refresh(audit)
    return SiteAuditResponse.model_validate(audit)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/site-audit  — list audits
# ---------------------------------------------------------------------------


@router.get("", response_model=SiteAuditListResponse)
async def list_site_audits(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SiteAuditListResponse:
    await _verify_project(project_id, user.tenant_id, db)

    result = await db.execute(
        select(SiteAudit)
        .where(SiteAudit.project_id == project_id)
        .order_by(SiteAudit.created_at.desc())
        .limit(20)
    )
    audits = list(result.scalars().all())
    await _mark_stale_audits_failed(audits, db)
    return SiteAuditListResponse(
        items=[SiteAuditResponse.model_validate(a) for a in audits]
    )


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/site-audit/latest  — most recent audit
# ---------------------------------------------------------------------------


@router.get("/latest", response_model=SiteAuditResponse)
async def get_latest_site_audit(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SiteAuditResponse:
    await _verify_project(project_id, user.tenant_id, db)

    result = await db.execute(
        select(SiteAudit)
        .where(SiteAudit.project_id == project_id)
        .order_by(SiteAudit.created_at.desc())
        .limit(1)
    )
    audit = result.scalar_one_or_none()
    if audit is None:
        raise HTTPException(status_code=404, detail="No site audits for this project")
    await _mark_stale_audits_failed([audit], db)
    return SiteAuditResponse.model_validate(audit)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/site-audit/{audit_id}  — audit detail
# ---------------------------------------------------------------------------


@router.get("/{audit_id}", response_model=SiteAuditResponse)
async def get_site_audit(
    project_id: UUID,
    audit_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SiteAuditResponse:
    await _verify_project(project_id, user.tenant_id, db)
    audit = await _get_audit(audit_id, project_id, db)
    await _mark_stale_audits_failed([audit], db)
    return SiteAuditResponse.model_validate(audit)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/site-audit/{audit_id}/report.pdf — PDF report
# ---------------------------------------------------------------------------


@router.get("/{audit_id}/report.pdf")
async def get_site_audit_pdf(
    project_id: UUID,
    audit_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    await _verify_project(project_id, user.tenant_id, db)
    audit = await _get_audit(audit_id, project_id, db)

    if audit.status != "completed" or not audit.result_json:
        raise HTTPException(
            status_code=409,
            detail="PDF report is only available for completed audits.",
        )

    from app.services.geo_report_pdf import generate_geo_audit_pdf

    pdf_bytes: bytes = await generate_geo_audit_pdf(audit.result_json)

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="geo-audit-{audit_id}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
