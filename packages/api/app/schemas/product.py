from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    features: list[str] | None = None
    pricing: str | None = None
    category: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    features: list[str] | None = None
    pricing: str | None = None
    category: str | None = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    features: list[str] | None = None
    pricing: str | None = None
    category: str | None = None
    brand_id: UUID
    created_at: datetime
    updated_at: datetime | None = None


class ProductSuggestionRequest(BaseModel):
    max_suggestions: int = Field(default=5, ge=1, le=10)


class ProductSuggestion(BaseModel):
    name: str
    description: str | None = None
    features: list[str] = Field(default_factory=list)
    pricing: str | None = None
    category: str | None = None
    evidence: list[str] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)


class ProductSuggestionResponse(BaseModel):
    suggestions: list[ProductSuggestion] = Field(default_factory=list)
    knowledge_entries_considered: int = 0
