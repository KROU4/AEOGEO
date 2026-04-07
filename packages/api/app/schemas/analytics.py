from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# --- Integration CRUD ---


class AnalyticsIntegrationCreate(BaseModel):
    provider: Literal["google_analytics", "yandex_metrica"]
    external_id: str
    credentials: str  # plaintext; encrypted before storage


class AnalyticsIntegrationUpdate(BaseModel):
    external_id: str | None = None
    credentials: str | None = None
    is_active: bool | None = None


class AnalyticsIntegrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    provider: str
    external_id: str
    is_active: bool
    last_synced_at: datetime | None
    created_at: datetime


# --- Traffic data ---


class TrafficDataPoint(BaseModel):
    date: date
    pageviews: int
    sessions: int
    users: int
    traffic_sources: dict[str, int]


class TrafficSummary(BaseModel):
    provider: str | None
    period_start: date
    period_end: date
    total_pageviews: int
    total_sessions: int
    total_users: int
    daily: list[TrafficDataPoint]
    traffic_sources: dict[str, int]  # aggregated


class TrafficSyncResult(BaseModel):
    synced: dict[str, int]  # provider -> row count
