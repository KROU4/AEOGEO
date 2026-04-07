"""Rate limiter — Redis-based sliding window counters for per-tenant limits."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from redis.asyncio import Redis

from app.models.tenant_quota import TenantQuota


@dataclass
class RateLimitResult:
    is_allowed: bool
    reason: str | None = None
    remaining: int | None = None


class RateLimiter:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def check_rate_limit(
        self, tenant_id: uuid.UUID, quota: TenantQuota | None
    ) -> RateLimitResult:
        if quota is None or not quota.is_active:
            return RateLimitResult(is_allowed=True)

        now = datetime.now(timezone.utc)
        tid = str(tenant_id)

        # Check requests per minute
        if quota.requests_per_minute is not None:
            minute_key = f"rl:{tid}:rpm:{now.strftime('%Y%m%d%H%M')}"
            count = await self.redis.get(minute_key)
            if count is not None and int(count) >= quota.requests_per_minute:
                return RateLimitResult(
                    is_allowed=False,
                    reason="usage.rate_limited",
                    remaining=0,
                )

        # Check requests per day
        if quota.requests_per_day is not None:
            day_key = f"rl:{tid}:rpd:{now.strftime('%Y%m%d')}"
            count = await self.redis.get(day_key)
            if count is not None and int(count) >= quota.requests_per_day:
                return RateLimitResult(
                    is_allowed=False,
                    reason="usage.rate_limited",
                    remaining=0,
                )

        # Check monthly token budget (approximate from Redis counter)
        if quota.monthly_token_budget is not None:
            month_key = f"rl:{tid}:monthly:{now.strftime('%Y%m')}"
            tokens = await self.redis.get(month_key)
            if tokens is not None and int(tokens) >= quota.monthly_token_budget:
                return RateLimitResult(
                    is_allowed=False,
                    reason="usage.limit_reached",
                    remaining=0,
                )

        return RateLimitResult(is_allowed=True)

    async def increment_usage(
        self, tenant_id: uuid.UUID, tokens: int
    ) -> None:
        now = datetime.now(timezone.utc)
        tid = str(tenant_id)

        pipe = self.redis.pipeline()

        # RPM counter (TTL: 120s)
        minute_key = f"rl:{tid}:rpm:{now.strftime('%Y%m%d%H%M')}"
        pipe.incr(minute_key)
        pipe.expire(minute_key, 120)

        # RPD counter (TTL: 48h)
        day_key = f"rl:{tid}:rpd:{now.strftime('%Y%m%d')}"
        pipe.incr(day_key)
        pipe.expire(day_key, 172800)

        # Monthly token counter (TTL: 35 days)
        month_key = f"rl:{tid}:monthly:{now.strftime('%Y%m')}"
        pipe.incrby(month_key, tokens)
        pipe.expire(month_key, 3024000)

        await pipe.execute()
