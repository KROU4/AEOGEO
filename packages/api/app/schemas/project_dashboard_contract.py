"""Aggregated project dashboard payloads (AVOP / Stitch contract)."""

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectDashboardResponse(BaseModel):
    period: str = Field(description="7d | 30d | 90d")
    overall_score: float
    overall_score_delta: float
    share_of_voice: float
    share_of_voice_delta: float
    avg_rank: float
    avg_rank_delta: float
    citation_rate: float
    citation_rate_delta: float
    sparklines: dict[str, list[float]]
    updated_at: datetime


class DashboardPlatformRow(BaseModel):
    engine: str
    sov_pct: float
    visibility_pct: float
    avg_rank: float
    run_count: int


class DashboardPlatformsResponse(BaseModel):
    platforms: list[DashboardPlatformRow]
