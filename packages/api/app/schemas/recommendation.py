"""Recommendation schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    category: str
    priority: str
    title: str
    description: str
    affected_keywords: list[str] | None = None
    run_id: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None


class RecommendationGenerateRequest(BaseModel):
    run_id: UUID | None = None


class RecommendationGenerateResponse(BaseModel):
    recommendations: list[RecommendationResponse]
    run_id: UUID
    scores_analyzed: int
