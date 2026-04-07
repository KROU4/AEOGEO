from pydantic import BaseModel


class VisibilityScore(BaseModel):
    score: float
    trend: float | None = None
    period: str


class ShareOfVoiceEntry(BaseModel):
    engine: str
    engine_id: str
    share: float
    mention_count: int


class SentimentBreakdown(BaseModel):
    positive: int
    neutral: int
    negative: int
    positive_pct: float
    neutral_pct: float
    negative_pct: float


class CitationRate(BaseModel):
    rate: float
    total_citations: int
    total_answers: int
    period: str


class ActivityItem(BaseModel):
    id: str
    type: str
    description: str
    timestamp: str
