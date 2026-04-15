"""Full site GEO audit orchestrator — runs all modules in parallel."""

from __future__ import annotations

import asyncio
from urllib.parse import urlparse

import httpx

from geo_audit.citability_core import analyze_html_citability
from geo_audit.content_quality import run_content_quality_audit
from geo_audit.llmstxt_full import run_llmstxt_audit
from geo_audit.models import (
    AuditIssue,
    ContentQualityResult,
    FullSiteAuditResult,
    LlmsTxtResult,
    SchemaAuditResult,
    TechnicalAuditResult,
)
from geo_audit.platform_scoring import compute_platform_scores
from geo_audit.schema_full import run_schema_audit
from geo_audit.technical_audit import run_technical_audit

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


def _normalize_url(url: str) -> str:
    u = url.strip()
    if not u:
        return u
    if not u.startswith(("http://", "https://")):
        u = f"https://{u}"
    return u


def _sort_issues(issues: list[AuditIssue]) -> list[AuditIssue]:
    return sorted(issues, key=lambda i: _SEVERITY_ORDER.get(i.severity, 99))


def _derive_recommendations(issues: list[AuditIssue]) -> list[str]:
    recs: list[str] = []
    seen: set[str] = set()
    for issue in issues:
        if issue.recommendation and issue.recommendation not in seen:
            seen.add(issue.recommendation)
            recs.append(issue.recommendation)
        if len(recs) >= 5:
            break
    return recs


def _make_failed_technical(error: str) -> TechnicalAuditResult:
    return TechnicalAuditResult(
        score=0.0,
        is_https=False,
        ttfb_ms=None,
        has_sitemap=False,
        sitemap_url_count=0,
        has_robots_txt=False,
        ai_crawler_access={},
        has_llmstxt=False,
        has_meta_robots_noindex=False,
        has_canonical=False,
        has_og_tags=False,
        has_mobile_viewport=False,
        x_robots_tag=None,
        score_crawlability=0.0,
        score_indexability=0.0,
        score_security=0.0,
        score_mobile=0.0,
        score_performance=0.0,
        score_ssr=0.0,
        issues=[
            AuditIssue(
                severity="critical",
                category="technical",
                message=f"Technical audit failed: {error}",
                recommendation="Check that the URL is reachable and try again.",
            )
        ],
    )


def _make_failed_schema(error: str) -> SchemaAuditResult:
    return SchemaAuditResult(
        score=0.0,
        schema_types=[],
        has_organization=False,
        has_website=False,
        has_search_action=False,
        has_breadcrumbs=False,
        has_speakable=False,
        same_as_count=0,
        is_server_rendered=False,
        schema_objects=[],
        issues=[
            AuditIssue(
                severity="critical",
                category="schema",
                message=f"Schema audit failed: {error}",
                recommendation="Ensure the page HTML is accessible and contains valid JSON-LD.",
            )
        ],
    )


def _make_failed_llmstxt(error: str) -> LlmsTxtResult:
    return LlmsTxtResult(
        score=0.0,
        has_llmstxt=False,
        has_llmstxt_full=False,
        llmstxt_url=None,
        section_count=0,
        link_count=0,
        valid_links=0,
        score_completeness=0.0,
        score_accuracy=0.0,
        score_usefulness=0.0,
        issues=[
            AuditIssue(
                severity="critical",
                category="llmstxt",
                message=f"llms.txt audit failed: {error}",
                recommendation="Ensure the site is reachable.",
            )
        ],
    )


def _make_failed_content(error: str) -> ContentQualityResult:
    return ContentQualityResult(
        score=0.0,
        word_count=0,
        heading_depth=0,
        paragraph_count=0,
        avg_sentence_length=0.0,
        statistical_density=0.0,
        has_author=False,
        has_publish_date=False,
        external_link_count=0,
        internal_link_count=0,
        score_experience=0.0,
        score_expertise=0.0,
        score_authoritativeness=0.0,
        score_trustworthiness=0.0,
        topical_authority_modifier=0.0,
        ai_scored=False,
        issues=[
            AuditIssue(
                severity="critical",
                category="content",
                message=f"Content quality audit failed: {error}",
                recommendation="Ensure the page HTML is accessible.",
            )
        ],
    )


async def run_full_audit(
    url: str,
    openai_api_key: str | None = None,
) -> FullSiteAuditResult:
    """Run all GEO audit modules in parallel and return a composite result."""
    normalized_url = _normalize_url(url)
    if not normalized_url:
        raise ValueError("url is required")

    html = ""
    try:
        async with httpx.AsyncClient(
            headers=DEFAULT_HEADERS, follow_redirects=True, timeout=40.0
        ) as client:
            r = await client.get(normalized_url)
            r.raise_for_status()
            html = r.text
    except httpx.HTTPError as exc:
        html = ""
        fetch_error = str(exc)
    else:
        fetch_error = None

    async def _run_technical() -> TechnicalAuditResult:
        try:
            return await run_technical_audit(normalized_url, html=html or None)
        except Exception as exc:
            return _make_failed_technical(str(exc))

    async def _run_schema() -> SchemaAuditResult:
        try:
            return run_schema_audit(html)
        except Exception as exc:
            return _make_failed_schema(str(exc))

    async def _run_llmstxt() -> LlmsTxtResult:
        try:
            return await run_llmstxt_audit(normalized_url)
        except Exception as exc:
            return _make_failed_llmstxt(str(exc))

    async def _run_content() -> ContentQualityResult:
        try:
            return await run_content_quality_audit(
                normalized_url,
                html=html or None,
                openai_api_key=openai_api_key,
            )
        except Exception as exc:
            return _make_failed_content(str(exc))

    async def _run_citability() -> float:
        try:
            result = analyze_html_citability(html) if html else {"average_citability_score": 0.0}
            return float(result.get("average_citability_score", 0.0))
        except Exception:
            return 0.0

    technical, schema, llmstxt, content, citability_score = await asyncio.gather(
        _run_technical(),
        _run_schema(),
        _run_llmstxt(),
        _run_content(),
        _run_citability(),
    )

    platforms = compute_platform_scores(
        ai_crawler_access=technical.ai_crawler_access,
        has_sitemap=technical.has_sitemap,
        has_llmstxt=technical.has_llmstxt,
        schema_types=schema.schema_types,
        has_og_tags=technical.has_og_tags,
        citability_score=citability_score,
        technical_score=technical.score,
        schema_score=schema.score,
        heading_depth=content.heading_depth,
    )

    brand_authority = 0.0

    overall_geo_score = round(
        citability_score * 0.25
        + content.score * 0.20
        + technical.score * 0.15
        + schema.score * 0.10
        + platforms.average * 0.10
        + brand_authority * 0.20,
        1,
    )
    overall_geo_score = min(100.0, max(0.0, overall_geo_score))

    all_issues: list[AuditIssue] = []
    all_issues.extend(technical.issues)
    all_issues.extend(schema.issues)
    all_issues.extend(llmstxt.issues)
    all_issues.extend(content.issues)

    if fetch_error:
        all_issues.insert(
            0,
            AuditIssue(
                severity="critical",
                category="technical",
                message=f"Homepage could not be fetched: {fetch_error}",
                recommendation="Ensure the URL is reachable and returns a 2xx HTTP status.",
            ),
        )

    top_issues = _sort_issues(all_issues)[:10]
    top_recommendations = _derive_recommendations(top_issues)

    return FullSiteAuditResult(
        url=normalized_url,
        overall_geo_score=overall_geo_score,
        citability_score=round(min(citability_score, 100.0), 1),
        technical=technical,
        schema=schema,
        llmstxt=llmstxt,
        content=content,
        platforms=platforms,
        brand_authority=brand_authority,
        top_issues=top_issues,
        top_recommendations=top_recommendations,
    )
