"""Per-engine query explorer."""

from uuid import UUID

from pydantic import BaseModel


class PlatformQueryRow(BaseModel):
    query_text: str
    rank: int
    brand_mentioned: bool
    mention_position: int | None
    citation_count: int
    answer_id: UUID


class PlatformQueriesResponse(BaseModel):
    engine: str
    queries: list[PlatformQueryRow]
    total: int
