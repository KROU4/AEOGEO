from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VisibilityScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    mention_score: float
    sentiment_score: float
    position_score: float
    recommendation_score: float
    citation_score: float
    accuracy_score: float
    total_score: float
    answer_id: UUID
    run_id: UUID
    query_id: UUID
    engine_id: UUID


class AggregatedScoreResponse(BaseModel):
    engine_id: UUID | None = None
    engine_name: str | None = None
    query_id: UUID | None = None
    query_text: str | None = None
    avg_mention_score: float
    avg_sentiment_score: float
    avg_positioning_score: float
    avg_recommendation_score: float
    avg_citation_score: float
    avg_accuracy_score: float
    avg_total_score: float
    sample_count: int


class ScoreTrendResponse(BaseModel):
    run_id: UUID
    run_date: datetime
    avg_total_score: float
    delta: float | None = None


class RunSummaryResponse(BaseModel):
    run_id: UUID
    score_count: int
    avg_total: float
    avg_mention: float
    avg_sentiment: float
    avg_position: float
    avg_accuracy: float
    avg_citation: float
    avg_recommendation: float
    min_total: float
    max_total: float


class ScoreByEngineResponse(BaseModel):
    engine_id: UUID
    engine_name: str | None = None
    score_count: int
    avg_total: float
    avg_mention: float
    avg_sentiment: float
    avg_position: float
    avg_accuracy: float
    avg_citation: float
    avg_recommendation: float


class ScoreByQueryResponse(BaseModel):
    query_id: UUID
    query_text: str | None = None
    score_count: int
    avg_total: float
    avg_mention: float
    avg_sentiment: float
    avg_position: float
    avg_accuracy: float
    avg_citation: float
    avg_recommendation: float


class ScoreTrendEntry(BaseModel):
    run_id: UUID
    created_at: str | None = None
    score_count: int
    avg_total: float
    avg_mention: float
    avg_sentiment: float
    avg_position: float
    avg_accuracy: float
    avg_citation: float
    avg_recommendation: float


class RunComparisonResponse(BaseModel):
    run_a: RunSummaryResponse
    run_b: RunSummaryResponse
