from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_url: str
    source_title: str | None = None
    is_client_source: bool
    answer_id: UUID
    created_at: datetime
