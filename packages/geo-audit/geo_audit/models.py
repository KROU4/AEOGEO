"""Pydantic models for quick GEO audit responses."""

from typing import Any

from pydantic import BaseModel, Field


class QuickAuditResult(BaseModel):
    """Result of a public quick GEO audit (landing / lead gen)."""

    overall_geo_score: float = Field(ge=0, le=100)
    citability_score: float = Field(ge=0, le=100)
    ai_crawler_access: dict[str, bool] = Field(
        description="Per-bot allow/deny inferred from robots.txt",
    )
    has_llms_txt: bool
    schema_org: dict[str, Any] = Field(
        description="Structured data summary, e.g. types present",
    )
    top_issues: list[str] = Field(max_length=5)
    top_recommendations: list[str] = Field(max_length=3)
