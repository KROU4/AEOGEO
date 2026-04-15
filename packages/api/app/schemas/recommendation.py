"""Recommendation schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    status: str = "pending"
    rank: int | None = Field(default=None, validation_alias="sort_rank")
    impact_estimate: str | None = None
    instructions: str | None = None
    source: str | None = None
    visibility_scope: str | None = Field(
        default=None,
        validation_alias="scope",
    )

    @model_validator(mode="after")
    def _default_scope(self) -> "RecommendationResponse":
        if self.visibility_scope is None:
            if self.category in {"technical", "content"}:
                self.visibility_scope = "internal"
            elif self.category in {"seo", "brand_positioning"}:
                self.visibility_scope = "external"
        return self


class RecommendationPatchRequest(BaseModel):
    status: str = Field(pattern="^(pending|done)$")


class RecommendationGenerateRequest(BaseModel):
    run_id: UUID | None = None


class RecommendationGenerateResponse(BaseModel):
    recommendations: list[RecommendationResponse]
    run_id: UUID
    scores_analyzed: int
