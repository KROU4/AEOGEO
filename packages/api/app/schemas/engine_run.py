from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EngineRunCreate(BaseModel):
    query_set_id: UUID
    engine_id: UUID
    sample_count: int = Field(default=1, ge=1, le=10)


class BatchRunStreamRequest(BaseModel):
    run_ids: list[UUID] = Field(..., min_length=1, max_length=10)


class EngineRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    engine_status: str
    parse_status: str
    score_status: str
    sample_count: int
    triggered_by: str
    error_message: str | None = None
    answers_expected: int
    answers_completed: int
    parse_completed: int
    score_completed: int
    started_at: datetime | None = None
    completed_at: datetime | None = None
    engine_started_at: datetime | None = None
    engine_completed_at: datetime | None = None
    parse_started_at: datetime | None = None
    parse_completed_at: datetime | None = None
    score_started_at: datetime | None = None
    score_completed_at: datetime | None = None
    query_set_id: UUID
    engine_id: UUID
    project_id: UUID
    created_at: datetime


class RunStageProgress(BaseModel):
    status: str
    total: int
    completed: int


class EngineRunProgress(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    engine_status: str
    parse_status: str
    score_status: str
    error_message: str | None = None
    engine: RunStageProgress
    parse: RunStageProgress
    score: RunStageProgress
