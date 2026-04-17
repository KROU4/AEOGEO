"""Pydantic models for GEO audit responses."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InfrastructureCheck(BaseModel):
    """Single quick infrastructure signal for the public lead magnet."""

    key: str
    label: str
    passed: bool
    score: float = Field(ge=0, le=40)
    details: str


class QuickAuditResult(BaseModel):
    """Result of a public quick GEO audit (landing / lead gen)."""

    audit_id: UUID | None = Field(
        default=None,
        description="Persisted public audit row id (set by API after save).",
    )
    overall_geo_score: float = Field(ge=0, le=100)
    citability_score: float = Field(ge=0, le=100)
    ai_crawler_access: dict[str, bool] = Field(
        description="Per-bot allow/deny inferred from robots.txt",
    )
    has_llms_txt: bool
    has_sitemap: bool = False
    sitemap_url_count: int = 0
    robots_txt_status: str = "unknown"
    llms_txt_status: str = "unknown"
    infrastructure_checks: list[InfrastructureCheck] = Field(default_factory=list)
    readiness_label: str = "Needs work"
    schema_org: dict[str, Any] = Field(
        description="Structured data summary, e.g. types present",
    )
    top_issues: list[str] = Field(max_length=5)
    top_recommendations: list[str] = Field(max_length=3)


class AuditIssue(BaseModel):
    severity: str  # "critical", "warning", "info"
    category: str  # "technical", "schema", "content", "llmstxt", "platform", "crawler"
    message: str
    recommendation: str | None = None


class TechnicalAuditResult(BaseModel):
    score: float = Field(ge=0, le=100)
    is_https: bool
    ttfb_ms: float | None
    has_sitemap: bool
    sitemap_url_count: int
    has_robots_txt: bool
    ai_crawler_access: dict[str, str]  # crawler_name -> status string
    has_llmstxt: bool
    has_meta_robots_noindex: bool
    has_canonical: bool
    has_og_tags: bool
    has_mobile_viewport: bool
    x_robots_tag: str | None
    score_crawlability: float
    score_indexability: float
    score_security: float
    score_mobile: float
    score_performance: float
    score_ssr: float
    issues: list[AuditIssue]


class SchemaAuditResult(BaseModel):
    score: float = Field(ge=0, le=100)
    schema_types: list[str]
    has_organization: bool
    has_website: bool
    has_search_action: bool
    has_breadcrumbs: bool
    has_speakable: bool
    same_as_count: int
    is_server_rendered: bool
    schema_objects: list[dict[str, Any]]  # parsed JSON-LD objects
    issues: list[AuditIssue]


class LlmsTxtResult(BaseModel):
    score: float = Field(ge=0, le=100)
    has_llmstxt: bool
    has_llmstxt_full: bool
    llmstxt_url: str | None
    section_count: int
    link_count: int
    valid_links: int
    score_completeness: float
    score_accuracy: float
    score_usefulness: float
    issues: list[AuditIssue]
    generated_template: str | None = None


class ContentQualityResult(BaseModel):
    score: float = Field(ge=0, le=100)
    word_count: int
    heading_depth: int
    paragraph_count: int
    avg_sentence_length: float
    statistical_density: float
    has_author: bool
    has_publish_date: bool
    external_link_count: int
    internal_link_count: int
    score_experience: float
    score_expertise: float
    score_authoritativeness: float
    score_trustworthiness: float
    topical_authority_modifier: float
    ai_scored: bool
    issues: list[AuditIssue]


class PlatformScores(BaseModel):
    google_aio: float = Field(ge=0, le=100)
    chatgpt: float = Field(ge=0, le=100)
    perplexity: float = Field(ge=0, le=100)
    gemini: float = Field(ge=0, le=100)
    copilot: float = Field(ge=0, le=100)
    average: float = Field(ge=0, le=100)


class CriticalIssue(BaseModel):
    id: str  # e.g. "CRIT-01"
    title: str
    detail: str
    fix: str


class AiInsights(BaseModel):
    executive_summary: str = ""
    root_cause: str = ""
    critical_issues: list[CriticalIssue] = Field(default_factory=list)
    action_plan: dict[str, list[str]] = Field(default_factory=dict)


class FullSiteAuditResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: str
    overall_geo_score: float = Field(ge=0, le=100)
    citability_score: float = Field(ge=0, le=100)
    technical: TechnicalAuditResult
    schema: SchemaAuditResult
    llmstxt: LlmsTxtResult
    content: ContentQualityResult
    platforms: PlatformScores
    brand_authority: float = Field(default=0.0, ge=0, le=100)
    top_issues: list[AuditIssue]  # top 10, sorted by severity
    top_recommendations: list[str]  # top 5 actionable recommendations
    pages_analyzed: int = 1
    ai_insights: AiInsights | None = None
