from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FeedbackCreate(BaseModel):
    entity_type: str
    entity_id: UUID
    feedback: str
    notes: str | None = None


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: str
    entity_id: UUID
    feedback: str
    notes: str | None = None
    user_id: UUID
    created_at: datetime


class FeedbackStats(BaseModel):
    total_likes: int
    total_dislikes: int
    entity_type: str
