"""Public GEO quick audit (lead gen)."""

from __future__ import annotations

import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from geo_audit.models import QuickAuditResult
from geo_audit.service import GeoAuditService
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_redis
from app.models.public_audit import PublicAudit
from app.schemas.audit import QuickAuditEmailBody, QuickAuditRequest
from app.utils.client_ip import get_client_ip

router = APIRouter(prefix="/audit", tags=["audit"])

_QUICK_AUDIT_LIMIT = 5
_QUICK_AUDIT_WINDOW_SEC = 3600


def _ip_hash(ip: str) -> str:
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


async def _enforce_quick_audit_rate(redis: Redis, ip_h: str) -> None:
    key = f"audit:quick:{ip_h}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, _QUICK_AUDIT_WINDOW_SEC)
    if count > _QUICK_AUDIT_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "audit.rate_limited",
                "message": "Too many quick audits. Try again later.",
            },
        )


@router.post("/quick", response_model=QuickAuditResult)
async def quick_audit(
    request: Request,
    body: QuickAuditRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> QuickAuditResult:
    ip_h = _ip_hash(get_client_ip(request))
    await _enforce_quick_audit_rate(redis, ip_h)

    service = GeoAuditService()
    try:
        result = await service.run_quick_audit(body.url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "audit.invalid_url", "message": str(exc)},
        ) from exc

    email_norm = body.email.strip().lower() if body.email else None
    row = PublicAudit(
        url=body.url.strip(),
        email=email_norm,
        geo_score=result.overall_geo_score,
        result_json=result.model_dump(),
        linked_user_id=None,
        ip_hash=ip_h,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(row)

    return QuickAuditResult(**{**result.model_dump(), "audit_id": row.id})


@router.patch("/quick/{audit_id}/email")
async def patch_quick_audit_email(
    audit_id: UUID,
    body: QuickAuditEmailBody,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(select(PublicAudit).where(PublicAudit.id == audit_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Audit not found")
    row.email = body.email.strip().lower()
    await db.commit()
    return {"audit_id": str(audit_id), "email": row.email}
