from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BrandCreate(BaseModel):
    name: str
    description: str | None = None
    positioning: str | None = None
    website: str | None = None
    allowed_phrases: list[str] | None = None
    forbidden_phrases: list[str] | None = None
    voice_guidelines: str | None = None
    industry: str | None = None
    target_audience: str | None = None


class BrandUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    positioning: str | None = None
    website: str | None = None
    allowed_phrases: list[str] | None = None
    forbidden_phrases: list[str] | None = None
    voice_guidelines: str | None = None
    industry: str | None = None
    target_audience: str | None = None


class BrandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    positioning: str | None = None
    website: str | None = None
    allowed_phrases: list[str] | None = None
    forbidden_phrases: list[str] | None = None
    voice_guidelines: str | None = None
    industry: str | None = None
    target_audience: str | None = None
    project_id: UUID
    created_at: datetime
    updated_at: datetime | None = None


class BrandAutofillRequest(BaseModel):
    domain: str
    locale: str = "en"


class BrandAutofillResponse(BaseModel):
    name: str = ""
    description: str = ""
    industry: str = ""
    tone_of_voice: str = ""
    target_audience: str = ""
    unique_selling_points: list[str] = []
