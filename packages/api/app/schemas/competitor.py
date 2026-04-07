from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CompetitorCreate(BaseModel):
    name: str
    website: str | None = None
    positioning: str | None = None
    notes: str | None = None


class CompetitorUpdate(BaseModel):
    name: str | None = None
    website: str | None = None
    positioning: str | None = None
    notes: str | None = None


class CompetitorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    website: str | None = None
    positioning: str | None = None
    notes: str | None = None
    brand_id: UUID
    created_at: datetime
    updated_at: datetime | None = None


class CompetitorSuggestionRequest(BaseModel):
    max_suggestions: int = Field(default=5, ge=1, le=10)


class CompetitorSuggestion(BaseModel):
    name: str
    website: str | None = None
    positioning: str | None = None
    notes: str | None = None
    evidence: list[str] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)


class CompetitorSuggestionResponse(BaseModel):
    suggestions: list[CompetitorSuggestion] = Field(default_factory=list)
    search_results_considered: int = 0
