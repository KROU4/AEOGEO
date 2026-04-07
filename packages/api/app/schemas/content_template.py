from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContentTemplateCreate(BaseModel):
    name: str
    content_type: str
    template_prompt: str
    structure_schema: dict | None = None


class ContentTemplateUpdate(BaseModel):
    name: str | None = None
    content_type: str | None = None
    template_prompt: str | None = None
    structure_schema: dict | None = None


class ContentTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    content_type: str
    template_prompt: str
    structure_schema: dict | None = None
    created_at: datetime
    updated_at: datetime | None = None


class ContentTemplateGenerateRequest(BaseModel):
    template_id: UUID
    topic: str
    extra_context: str | None = None
