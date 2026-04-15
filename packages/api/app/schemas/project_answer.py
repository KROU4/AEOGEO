"""Project-scoped answer payload with highlight spans."""

from uuid import UUID

from pydantic import BaseModel, Field


class BrandMentionSpan(BaseModel):
    brand: str
    start: int = Field(ge=0)
    end: int = Field(ge=0)


class ProjectAnswerDetailResponse(BaseModel):
    answer_id: UUID
    engine: str
    query_text: str
    raw_text: str
    brand_mentions: list[BrandMentionSpan]
