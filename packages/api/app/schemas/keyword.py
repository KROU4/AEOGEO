"""Keyword schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class KeywordCreate(BaseModel):
    keyword: str
    category: str = "general"
    search_volume: int | None = None
    relevance_score: float | None = None
    is_selected: bool = True


class KeywordBulkCreate(BaseModel):
    keywords: list[KeywordCreate]


class KeywordUpdate(BaseModel):
    keyword: str | None = None
    category: str | None = None
    search_volume: int | None = None
    relevance_score: float | None = None
    is_selected: bool | None = None


class KeywordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    keyword: str
    category: str
    search_volume: int | None
    relevance_score: float | None
    is_selected: bool
    created_at: datetime
    updated_at: datetime | None = None


class KeywordGenerateRequest(BaseModel):
    max_keywords: int = 20
    categories: list[str] | None = None


class KeywordGenerateResponse(BaseModel):
    keywords: list[KeywordResponse]
    knowledge_entries_considered: int
