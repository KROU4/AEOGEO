"""Site GEO audit router — start, list, and retrieve audits per project."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
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


async def _run_site_audit_bg(audit_id: UUID, url: str) -> None:
    """Run the full GEO audit in a FastAPI background task (no Temporal required)."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from geo_audit.full_audit import run_full_audit

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as session:
            audit = await session.get(SiteAudit, audit_id)
            if audit is None:
                return
            audit.status = "running"
            await session.commit()

        openai_key: str | None = settings.openai_api_key or None
        anthropic_key: str | None = settings.anthropic_api_key or None
        result = await run_full_audit(
            url,
            openai_api_key=openai_key,
            anthropic_api_key=anthropic_key,
        )

        async with session_factory() as session:
            audit = await session.get(SiteAudit, audit_id)
            if audit is not None:
                audit.status = "completed"
                audit.overall_geo_score = float(result.overall_geo_score)
                audit.result_json = result.model_dump()
                await session.commit()

    except Exception as exc:
        logger.exception("Background site audit failed for audit %s: %s", audit_id, exc)
        try:
            async with session_factory() as session:
                audit = await session.get(SiteAudit, audit_id)
                if audit is not None:
                    audit.status = "failed"
                    audit.error_message = str(exc)
                    await session.commit()
        except Exception:
            pass
    finally:
        await engine.dispose()


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
    background_tasks: BackgroundTasks,
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

    background_tasks.add_task(_run_site_audit_bg, audit.id, url)

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
