"""AI usage tracking service — record events and query aggregated usage."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_usage_event import AIUsageEvent
from app.models.tenant_quota import TenantQuota
from app.services.ai_pricing import calculate_cost


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UsageSummary:
    def __init__(
        self,
        total_requests: int = 0,
        total_input_tokens: int = 0,
        total_output_tokens: int = 0,
        total_tokens: int = 0,
        total_cost_usd: Decimal = Decimal("0"),
    ):
        self.total_requests = total_requests
        self.total_input_tokens = total_input_tokens
        self.total_output_tokens = total_output_tokens
        self.total_tokens = total_tokens
        self.total_cost_usd = total_cost_usd


class QuotaStatus:
    def __init__(
        self,
        tokens_used: int = 0,
        tokens_limit: int | None = None,
        cost_used: Decimal = Decimal("0"),
        cost_limit: Decimal | None = None,
        requests_today: int = 0,
        requests_day_limit: int | None = None,
        requests_this_month: int = 0,
        warning_threshold_pct: int = 80,
    ):
        self.tokens_used = tokens_used
        self.tokens_limit = tokens_limit
        self.cost_used = cost_used
        self.cost_limit = cost_limit
        self.requests_today = requests_today
        self.requests_day_limit = requests_day_limit
        self.requests_this_month = requests_this_month
        self.warning_threshold_pct = warning_threshold_pct

    @property
    def tokens_pct(self) -> float:
        if not self.tokens_limit:
            return 0.0
        return min(self.tokens_used / self.tokens_limit * 100, 100.0)

    @property
    def cost_pct(self) -> float:
        if not self.cost_limit:
            return 0.0
        return min(float(self.cost_used / self.cost_limit * 100), 100.0)

    @property
    def warning_active(self) -> bool:
        return self.tokens_pct >= self.warning_threshold_pct or self.cost_pct >= self.warning_threshold_pct

    @property
    def limit_reached(self) -> bool:
        if self.tokens_limit and self.tokens_used >= self.tokens_limit:
            return True
        if self.cost_limit and self.cost_used >= self.cost_limit:
            return True
        return False


class AIUsageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_usage(
        self,
        tenant_id: uuid.UUID,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        request_type: str,
        user_id: uuid.UUID | None = None,
        project_id: uuid.UUID | None = None,
        duration_ms: int | None = None,
        status: str = "success",
        error_message: str | None = None,
    ) -> AIUsageEvent:
        total_tokens = input_tokens + output_tokens
        cost = calculate_cost(model, input_tokens, output_tokens)

        event = AIUsageEvent(
            tenant_id=tenant_id,
            user_id=user_id,
            project_id=project_id,
            provider=provider,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            cost_usd=cost,
            request_type=request_type,
            duration_ms=duration_ms,
            status=status,
            error_message=error_message,
        )
        self.db.add(event)
        await self.db.flush()
        return event

    async def get_tenant_usage_summary(
        self,
        tenant_id: uuid.UUID,
        start: datetime,
        end: datetime,
    ) -> UsageSummary:
        start = _naive_utc(start)
        end = _naive_utc(end)
        result = await self.db.execute(
            select(
                func.count().label("total_requests"),
                func.coalesce(func.sum(AIUsageEvent.input_tokens), 0).label("total_input_tokens"),
                func.coalesce(func.sum(AIUsageEvent.output_tokens), 0).label("total_output_tokens"),
                func.coalesce(func.sum(AIUsageEvent.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(AIUsageEvent.cost_usd), 0).label("total_cost_usd"),
            ).where(
                AIUsageEvent.tenant_id == tenant_id,
                AIUsageEvent.created_at >= start,
                AIUsageEvent.created_at < end,
                AIUsageEvent.status == "success",
            )
        )
        row = result.one()
        return UsageSummary(
            total_requests=row.total_requests,
            total_input_tokens=row.total_input_tokens,
            total_output_tokens=row.total_output_tokens,
            total_tokens=row.total_tokens,
            total_cost_usd=Decimal(str(row.total_cost_usd)),
        )

    async def get_tenant_usage_by_provider(
        self,
        tenant_id: uuid.UUID,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        start = _naive_utc(start)
        end = _naive_utc(end)
        result = await self.db.execute(
            select(
                AIUsageEvent.provider,
                func.count().label("total_requests"),
                func.coalesce(func.sum(AIUsageEvent.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(AIUsageEvent.cost_usd), 0).label("total_cost_usd"),
            )
            .where(
                AIUsageEvent.tenant_id == tenant_id,
                AIUsageEvent.created_at >= start,
                AIUsageEvent.created_at < end,
                AIUsageEvent.status == "success",
            )
            .group_by(AIUsageEvent.provider)
            .order_by(func.sum(AIUsageEvent.cost_usd).desc())
        )
        return [
            {
                "provider": row.provider,
                "total_requests": row.total_requests,
                "total_tokens": row.total_tokens,
                "total_cost_usd": Decimal(str(row.total_cost_usd)),
            }
            for row in result.all()
        ]

    async def get_tenant_usage_by_model(
        self,
        tenant_id: uuid.UUID,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        start = _naive_utc(start)
        end = _naive_utc(end)
        result = await self.db.execute(
            select(
                AIUsageEvent.provider,
                AIUsageEvent.model,
                func.count().label("total_requests"),
                func.coalesce(func.sum(AIUsageEvent.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(AIUsageEvent.cost_usd), 0).label("total_cost_usd"),
            )
            .where(
                AIUsageEvent.tenant_id == tenant_id,
                AIUsageEvent.created_at >= start,
                AIUsageEvent.created_at < end,
                AIUsageEvent.status == "success",
            )
            .group_by(AIUsageEvent.provider, AIUsageEvent.model)
            .order_by(func.sum(AIUsageEvent.cost_usd).desc())
        )
        return [
            {
                "provider": row.provider,
                "model": row.model,
                "total_requests": row.total_requests,
                "total_tokens": row.total_tokens,
                "total_cost_usd": Decimal(str(row.total_cost_usd)),
            }
            for row in result.all()
        ]

    async def get_tenant_usage_timeseries(
        self,
        tenant_id: uuid.UUID,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        start = _naive_utc(start)
        end = _naive_utc(end)
        result = await self.db.execute(
            select(
                func.date_trunc("day", AIUsageEvent.created_at).label("date"),
                func.count().label("total_requests"),
                func.coalesce(func.sum(AIUsageEvent.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(AIUsageEvent.cost_usd), 0).label("total_cost_usd"),
            )
            .where(
                AIUsageEvent.tenant_id == tenant_id,
                AIUsageEvent.created_at >= start,
                AIUsageEvent.created_at < end,
                AIUsageEvent.status == "success",
            )
            .group_by(func.date_trunc("day", AIUsageEvent.created_at))
            .order_by(func.date_trunc("day", AIUsageEvent.created_at))
        )
        return [
            {
                "date": row.date.isoformat(),
                "total_requests": row.total_requests,
                "total_tokens": row.total_tokens,
                "total_cost_usd": Decimal(str(row.total_cost_usd)),
            }
            for row in result.all()
        ]

    async def get_current_month_quota_status(
        self, tenant_id: uuid.UUID
    ) -> QuotaStatus:
        now = _utcnow_naive()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Get quota config
        quota_result = await self.db.execute(
            select(TenantQuota).where(TenantQuota.tenant_id == tenant_id)
        )
        quota = quota_result.scalar_one_or_none()

        # Monthly usage
        monthly = await self.get_tenant_usage_summary(tenant_id, month_start, now)

        # Today's request count
        today_result = await self.db.execute(
            select(func.count()).where(
                AIUsageEvent.tenant_id == tenant_id,
                AIUsageEvent.created_at >= today_start,
                AIUsageEvent.status == "success",
            )
        )
        requests_today = today_result.scalar() or 0

        return QuotaStatus(
            tokens_used=monthly.total_tokens,
            tokens_limit=quota.monthly_token_budget if quota else None,
            cost_used=monthly.total_cost_usd,
            cost_limit=quota.monthly_cost_budget_usd if quota else None,
            requests_today=requests_today,
            requests_day_limit=quota.requests_per_day if quota else None,
            requests_this_month=monthly.total_requests,
            warning_threshold_pct=quota.warning_threshold_pct if quota else 80,
        )

    async def get_all_tenants_usage(
        self, start: datetime, end: datetime
    ) -> list[dict]:
        start = _naive_utc(start)
        end = _naive_utc(end)
        from app.models.tenant import Tenant

        result = await self.db.execute(
            select(
                Tenant.id,
                Tenant.name,
                func.count(AIUsageEvent.id).label("total_requests"),
                func.coalesce(func.sum(AIUsageEvent.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(AIUsageEvent.cost_usd), 0).label("total_cost_usd"),
            )
            .join(AIUsageEvent, AIUsageEvent.tenant_id == Tenant.id, isouter=True)
            .where(
                (AIUsageEvent.created_at >= start) | (AIUsageEvent.created_at.is_(None)),
                (AIUsageEvent.created_at < end) | (AIUsageEvent.created_at.is_(None)),
            )
            .group_by(Tenant.id, Tenant.name)
            .order_by(func.coalesce(func.sum(AIUsageEvent.cost_usd), 0).desc())
        )
        return [
            {
                "tenant_id": str(row.id),
                "tenant_name": row.name,
                "total_requests": row.total_requests,
                "total_tokens": row.total_tokens,
                "total_cost_usd": Decimal(str(row.total_cost_usd)),
            }
            for row in result.all()
        ]
