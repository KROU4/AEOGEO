"""Client-facing usage endpoints — scoped to the authenticated user's tenant."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.ai_usage import (
    ModelUsageResponse,
    ProviderUsageResponse,
    QuotaStatusResponse,
    TimeseriesPointResponse,
    UsageBreakdownResponse,
    UsageSummaryResponse,
)
from app.services.ai_usage import AIUsageService

router = APIRouter(
    prefix="/usage",
    tags=["usage"],
)


def _month_range() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start, now


@router.get("/summary", response_model=UsageSummaryResponse)
async def get_usage_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AIUsageService(db)
    start, end = _month_range()
    summary = await service.get_tenant_usage_summary(user.tenant_id, start, end)
    return UsageSummaryResponse(
        total_requests=summary.total_requests,
        total_input_tokens=summary.total_input_tokens,
        total_output_tokens=summary.total_output_tokens,
        total_tokens=summary.total_tokens,
        total_cost_usd=float(summary.total_cost_usd),
    )


@router.get("/quota-status", response_model=QuotaStatusResponse)
async def get_quota_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AIUsageService(db)
    qs = await service.get_current_month_quota_status(user.tenant_id)
    return QuotaStatusResponse(
        tokens_used=qs.tokens_used,
        tokens_limit=qs.tokens_limit,
        tokens_pct=qs.tokens_pct,
        cost_used=float(qs.cost_used),
        cost_limit=float(qs.cost_limit) if qs.cost_limit else None,
        cost_pct=qs.cost_pct,
        requests_today=qs.requests_today,
        requests_day_limit=qs.requests_day_limit,
        requests_this_month=qs.requests_this_month,
        warning_threshold_pct=qs.warning_threshold_pct,
        warning_active=qs.warning_active,
        limit_reached=qs.limit_reached,
    )


@router.get("/breakdown", response_model=UsageBreakdownResponse)
async def get_usage_breakdown(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AIUsageService(db)
    start, end = _month_range()
    by_provider = await service.get_tenant_usage_by_provider(
        user.tenant_id, start, end
    )
    by_model = await service.get_tenant_usage_by_model(
        user.tenant_id, start, end
    )
    return UsageBreakdownResponse(
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
    )


@router.get("/timeseries", response_model=list[TimeseriesPointResponse])
async def get_usage_timeseries(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AIUsageService(db)
    start, end = _month_range()
    points = await service.get_tenant_usage_timeseries(
        user.tenant_id, start, end
    )
    return [
        TimeseriesPointResponse(
            date=p["date"],
            total_requests=p["total_requests"],
            total_tokens=p["total_tokens"],
            total_cost_usd=float(p["total_cost_usd"]),
        )
        for p in points
    ]
