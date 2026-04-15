"""Site GEO audit router — start, list, and retrieve audits per project."""
from __future__ import annotations

import logging
import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.brand import Brand
from app.models.project import Project
from app.models.site_audit import SiteAudit
from app.models.user import User
from app.schemas.site_audit import (
    SiteAuditListResponse,
    SiteAuditResponse,
    SiteAuditStartRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/site-audit", tags=["site-audit"])


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

    temporal_host = os.getenv("TEMPORAL_HOST", "temporal:7233")
    temporal_client = await TemporalClient.connect(temporal_host)
    workflow_id = f"site-audit-{audit_id}"
    await temporal_client.start_workflow(
        "SiteAuditWorkflow",
        {"audit_id": str(audit_id), "url": url},
        id=workflow_id,
        task_queue="aeogeo-pipeline",
    )
    return workflow_id


# ---------------------------------------------------------------------------
# POST /projects/{project_id}/site-audit  — start a new audit
# ---------------------------------------------------------------------------


@router.post("", response_model=SiteAuditResponse, status_code=201)
async def start_site_audit(
    project_id: UUID,
    body: SiteAuditStartRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SiteAuditResponse:
    await _verify_project(project_id, user.tenant_id, db)

    url = body.url
    if not url:
        brand = await db.scalar(
            select(Brand).where(Brand.project_id == project_id)
        )
        url = brand.website if brand else None

    if not url:
        raise HTTPException(
            status_code=422,
            detail="No URL provided and no brand website configured for this project.",
        )

    audit = SiteAudit(
        project_id=project_id,
        url=url,
        status="pending",
        overall_geo_score=0,
    )
    db.add(audit)
    await db.flush()
    await db.refresh(audit)

    # Start Temporal workflow (best-effort — if Temporal is unavailable the
    # audit record still exists with status=pending so it can be retried).
    try:
        workflow_id = await _start_site_audit_workflow(audit.id, url)
        audit.temporal_workflow_id = workflow_id
    except Exception:
        logger.warning(
            "Failed to start Temporal SiteAuditWorkflow for audit %s — "
            "audit saved with status=pending",
            audit.id,
            exc_info=True,
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
