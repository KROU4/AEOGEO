from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.citation import CitationResponse
from app.schemas.mention import MentionResponse
from app.schemas.visibility_score import VisibilityScoreResponse


class AnswerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sample_index: int
    raw_response: str
    query_text: str
    engine_name: str
    engine_provider: str
    response_metadata: dict | None = None
    parse_status: str
    parse_error: str | None = None
    score_status: str
    score_error: str | None = None
    run_id: UUID
    query_id: UUID
    engine_id: UUID
    created_at: datetime


class AnswerDetail(AnswerResponse):
    mentions: list[MentionResponse] = []
    citations: list[CitationResponse] = []
    score: VisibilityScoreResponse | None = None
