"""Admin AI usage monitoring endpoints — super-admin only."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_system_admin
from app.models.tenant_quota import TenantQuota
from app.models.user import User
from app.schemas.ai_usage import (
    ModelUsageResponse,
    ProviderUsageResponse,
    QuotaStatusResponse,
    TenantUsageDetailResponse,
    TenantQuotaResponse,
    TenantQuotaUpdate,
    TenantUsageOverviewResponse,
    TimeseriesPointResponse,
    UsageBreakdownResponse,
    UsageSummaryResponse,
)
from app.services.ai_usage import AIUsageService

router = APIRouter(
    prefix="/admin/ai-usage",
    tags=["admin"],
)


def _month_range() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start, now


@router.get("/tenants", response_model=list[TenantUsageOverviewResponse])
async def list_tenants_usage(
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AIUsageService(db)
    start, end = _month_range()
    tenants = await service.get_all_tenants_usage(start, end)

    # Enrich with quota percentage
    results = []
    for t in tenants:
        quota_pct = None
        quota_result = await db.execute(
            select(TenantQuota).where(
                TenantQuota.tenant_id == UUID(t["tenant_id"])
            )
        )
        quota = quota_result.scalar_one_or_none()
        if quota and quota.monthly_token_budget:
            quota_pct = min(
                t["total_tokens"] / quota.monthly_token_budget * 100, 100.0
            )

        results.append(
            TenantUsageOverviewResponse(
                tenant_id=t["tenant_id"],
                tenant_name=t["tenant_name"],
                total_requests=t["total_requests"],
                total_tokens=t["total_tokens"],
                total_cost_usd=float(t["total_cost_usd"]),
                quota_pct=quota_pct,
            )
        )
    return results


@router.get("/tenants/{tenant_id}", response_model=TenantUsageDetailResponse)
async def get_tenant_usage_detail(
    tenant_id: UUID,
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AIUsageService(db)
    start, end = _month_range()

    summary = await service.get_tenant_usage_summary(tenant_id, start, end)
    by_provider = await service.get_tenant_usage_by_provider(tenant_id, start, end)
    by_model = await service.get_tenant_usage_by_model(tenant_id, start, end)
    timeseries = await service.get_tenant_usage_timeseries(tenant_id, start, end)
    quota_status = await service.get_current_month_quota_status(tenant_id)

    return TenantUsageDetailResponse(
        summary=UsageSummaryResponse(
            total_requests=summary.total_requests,
            total_input_tokens=summary.total_input_tokens,
            total_output_tokens=summary.total_output_tokens,
            total_tokens=summary.total_tokens,
            total_cost_usd=float(summary.total_cost_usd),
        ),
        breakdown=UsageBreakdownResponse(
            by_provider=[
                ProviderUsageResponse(
                    provider=p["provider"],
                    total_requests=p["total_requests"],
                    total_tokens=p["total_tokens"],
                    total_cost_usd=float(p["total_cost_usd"]),
                )
                for p in by_provider
            ],
            by_model=[
                ModelUsageResponse(
                    provider=m["provider"],
                    model=m["model"],
                    total_requests=m["total_requests"],
                    total_tokens=m["total_tokens"],
                    total_cost_usd=float(m["total_cost_usd"]),
                )
                for m in by_model
            ],
        ),
        timeseries=[
            TimeseriesPointResponse(
                date=p["date"],
                total_requests=p["total_requests"],
                total_tokens=p["total_tokens"],
                total_cost_usd=float(p["total_cost_usd"]),
            )
            for p in timeseries
        ],
        quota_status=QuotaStatusResponse(
            tokens_used=quota_status.tokens_used,
            tokens_limit=quota_status.tokens_limit,
            tokens_pct=quota_status.tokens_pct,
            cost_used=float(quota_status.cost_used),
            cost_limit=float(quota_status.cost_limit) if quota_status.cost_limit else None,
            cost_pct=quota_status.cost_pct,
            requests_today=quota_status.requests_today,
            requests_day_limit=quota_status.requests_day_limit,
            requests_this_month=quota_status.requests_this_month,
            warning_threshold_pct=quota_status.warning_threshold_pct,
            warning_active=quota_status.warning_active,
            limit_reached=quota_status.limit_reached,
        ),
    )


@router.get("/tenants/{tenant_id}/quota", response_model=TenantQuotaResponse)
async def get_tenant_quota(
    tenant_id: UUID,
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TenantQuota).where(TenantQuota.tenant_id == tenant_id)
    )
    quota = result.scalar_one_or_none()
    if quota is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "quota.not_found"},
        )
    return TenantQuotaResponse(
        tenant_id=str(quota.tenant_id),
        monthly_token_budget=quota.monthly_token_budget,
        monthly_cost_budget_usd=float(quota.monthly_cost_budget_usd) if quota.monthly_cost_budget_usd else None,
        requests_per_minute=quota.requests_per_minute,
        requests_per_day=quota.requests_per_day,
        warning_threshold_pct=quota.warning_threshold_pct,
        is_active=quota.is_active,
    )


@router.put("/tenants/{tenant_id}/quota", response_model=TenantQuotaResponse)
async def update_tenant_quota(
    tenant_id: UUID,
    body: TenantQuotaUpdate,
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TenantQuota).where(TenantQuota.tenant_id == tenant_id)
    )
    quota = result.scalar_one_or_none()
    if quota is None:
        # Create default quota
        quota = TenantQuota(tenant_id=tenant_id)
        db.add(quota)

    if body.monthly_token_budget is not None:
        quota.monthly_token_budget = body.monthly_token_budget
    if body.monthly_cost_budget_usd is not None:
        quota.monthly_cost_budget_usd = body.monthly_cost_budget_usd
    if body.requests_per_minute is not None:
        quota.requests_per_minute = body.requests_per_minute
    if body.requests_per_day is not None:
        quota.requests_per_day = body.requests_per_day
    if body.warning_threshold_pct is not None:
        quota.warning_threshold_pct = body.warning_threshold_pct
    if body.is_active is not None:
        quota.is_active = body.is_active

    await db.commit()
    await db.refresh(quota)

    return TenantQuotaResponse(
        tenant_id=str(quota.tenant_id),
        monthly_token_budget=quota.monthly_token_budget,
        monthly_cost_budget_usd=float(quota.monthly_cost_budget_usd) if quota.monthly_cost_budget_usd else None,
        requests_per_minute=quota.requests_per_minute,
        requests_per_day=quota.requests_per_day,
        warning_threshold_pct=quota.warning_threshold_pct,
        is_active=quota.is_active,
    )
