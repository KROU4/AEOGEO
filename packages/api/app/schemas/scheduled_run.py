from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ScheduledRunCreate(BaseModel):
    query_set_id: UUID
    engine_ids: list[UUID]
    cron_expression: str
    sample_count: int = 1


class ScheduledRunUpdate(BaseModel):
    query_set_id: UUID | None = None
    engine_ids: list[UUID] | None = None
    cron_expression: str | None = None
    sample_count: int | None = None
    is_active: bool | None = None


class ScheduledRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    query_set_id: UUID
    engine_ids: list[UUID]
    cron_expression: str
    sample_count: int
    project_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None
