"""Schemas for SOV, trends, citations, and competitor comparison APIs."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SovBrandEntry(BaseModel):
    domain: str
    sov_pct: float
    is_client: bool


class ProjectSovResponse(BaseModel):
    brands: list[SovBrandEntry]
    total_tracked_brands: int
    updated_at: datetime


class ProjectTrendsResponse(BaseModel):
    labels: list[str]
    series: dict[str, list[float]]
    updated_at: datetime


class CitationRow(BaseModel):
    domain: str
    engine: str
    times_cited: int
    is_client_domain: bool
    first_seen: date | None
    query_preview: str | None
    trend: list[int]
    citation_ids: list[UUID]


class CitationsListResponse(BaseModel):
    total: int
    citations: list[CitationRow]
    updated_at: datetime


class CitationQueryDetail(BaseModel):
    query: str
    engine: str
    ai_response_excerpt: str
    cited_at: date | None


class CitationDomainDetailResponse(BaseModel):
    domain: str
    all_queries: list[CitationQueryDetail]


class CompetitorPlatformSlice(BaseModel):
    sov: float
    rank: float


class CompetitorComparisonBrand(BaseModel):
    domain: str
    is_client: bool
    overall_sov: float
    by_platform: dict[str, CompetitorPlatformSlice]
    trend: list[float]


class CompetitorsComparisonResponse(BaseModel):
    brands: list[CompetitorComparisonBrand]
    updated_at: datetime
    period: str = Field(description="Echo of ?period=7d|30d|90d")


class CompetitorsInsightResponse(BaseModel):
    insight: str
