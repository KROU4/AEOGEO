from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeEntryCreate(BaseModel):
    type: str
    content: str
    source_url: str | None = None


class KnowledgeEntryUpdate(BaseModel):
    type: str | None = None
    content: str | None = None
    source_url: str | None = None


class KnowledgeEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    content: str
    source_url: str | None = None
    brand_id: UUID
    version: int
    has_embedding: bool
    created_at: datetime
    updated_at: datetime | None = None


class CustomFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    file_type: str
    file_size: int
    brand_id: UUID
    created_at: datetime


class CrawlRequest(BaseModel):
    domain: str
    max_pages: int = 50


class CrawlPagePreview(BaseModel):
    url: str
    title: str | None = None
    status: str
    content_preview: str | None = None
    error_message: str | None = None


class CrawlKnowledgePreview(BaseModel):
    type: str
    content: str
    source_url: str | None = None


class CrawlResponse(BaseModel):
    pages_crawled: int = 0
    entries_created: int = 0
    extraction_errors: int = 0
    total_pages: int = 0
    pages: list[CrawlPagePreview] = Field(default_factory=list)
    knowledge_entries: list[CrawlKnowledgePreview] = Field(default_factory=list)


class CrawlStatusResponse(BaseModel):
    task_id: str
    status: str
    entries_found: int | None = None
    message: str | None = None


class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 10
