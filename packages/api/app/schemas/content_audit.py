from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContentAuditTriggerRequest(BaseModel):
    content_title: str | None = None
    content_url: str | None = None
    published_at: datetime | None = None
    mode: Literal["manual", "scheduled"] = "scheduled"
    delay_hours: int = 48


class ContentAuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    triggered_by_user_id: UUID | None
    content_title: str | None
    content_url: str | None
    published_at: datetime
    recheck_at: datetime
    status: str
    baseline_total_score: float
    baseline_mentions: int
    baseline_citations: int
    checked_total_score: float | None
    checked_mentions: int | None
    checked_citations: int | None
    delta_total_score: float | None
    delta_mentions: int | None
    delta_citations: int | None
    temporal_workflow_id: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime | None


class ContentAuditSummaryResponse(BaseModel):
    project_id: UUID
    total_events: int
    completed_events: int
    avg_delta_total_score: float
    total_delta_mentions: int
    total_delta_citations: int
