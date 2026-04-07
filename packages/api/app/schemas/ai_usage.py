from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class UsageSummaryResponse(BaseModel):
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_cost_usd: float


class QuotaStatusResponse(BaseModel):
    tokens_used: int
    tokens_limit: int | None
    tokens_pct: float
    cost_used: float
    cost_limit: float | None
    cost_pct: float
    requests_today: int
    requests_day_limit: int | None
    requests_this_month: int
    warning_threshold_pct: int
    warning_active: bool
    limit_reached: bool


class ProviderUsageResponse(BaseModel):
    provider: str
    total_requests: int
    total_tokens: int
    total_cost_usd: float


class ModelUsageResponse(BaseModel):
    provider: str
    model: str
    total_requests: int
    total_tokens: int
    total_cost_usd: float


class TimeseriesPointResponse(BaseModel):
    date: str
    total_requests: int
    total_tokens: int
    total_cost_usd: float


class UsageBreakdownResponse(BaseModel):
    by_provider: list[ProviderUsageResponse]
    by_model: list[ModelUsageResponse]


class TenantUsageOverviewResponse(BaseModel):
    tenant_id: str
    tenant_name: str
    total_requests: int
    total_tokens: int
    total_cost_usd: float
    quota_pct: float | None = None


class TenantQuotaResponse(BaseModel):
    tenant_id: str
    monthly_token_budget: int | None
    monthly_cost_budget_usd: float | None
    requests_per_minute: int | None
    requests_per_day: int | None
    warning_threshold_pct: int
    is_active: bool


class TenantQuotaUpdate(BaseModel):
    monthly_token_budget: int | None = None
    monthly_cost_budget_usd: Decimal | None = None
    requests_per_minute: int | None = None
    requests_per_day: int | None = None
    warning_threshold_pct: int | None = None
    is_active: bool | None = None


class TenantUsageDetailResponse(BaseModel):
    summary: UsageSummaryResponse
    breakdown: UsageBreakdownResponse
    timeseries: list[TimeseriesPointResponse]
    quota_status: QuotaStatusResponse
