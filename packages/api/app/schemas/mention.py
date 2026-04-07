from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MentionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: str
    entity_name: str
    sentiment: str
    position_in_answer: int
    is_recommended: bool
    context_snippet: str
    answer_id: UUID
    created_at: datetime
