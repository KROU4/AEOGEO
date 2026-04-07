from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContentCreate(BaseModel):
    title: str
    body: str
    content_type: str
    project_id: UUID


class ContentUpdate(BaseModel):
    title: str | None = None
    body: str | None = None


class ContentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    body: str
    content_type: str
    status: str
    author_name: str = ""
    project_id: UUID
    template_id: UUID | None = None
    reviewer_notes: str | None = None
    json_ld: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
    published_at: datetime | None = None


class ContentGenerateRequest(BaseModel):
    project_id: UUID
    topic: str
    content_type: str
