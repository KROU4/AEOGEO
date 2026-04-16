from __future__ import annotations

import asyncio

from geo_audit import full_audit
from geo_audit.models import (
    ContentQualityResult,
    LlmsTxtResult,
    SchemaAuditResult,
    TechnicalAuditResult,
)


class FakeResponse:
    status_code = 200
    text = """
    <html>
      <head><title>Example Brand</title></head>
      <body>
        Example Brand
        <script type="application/ld+json">
          {"@type": "Organization", "sameAs": ["https://linkedin.com/company/example"]}
        </script>
      </body>
    </html>
    """

    def raise_for_status(self) -> None:
        return None


class FakeAsyncClient:
    def __init__(self, *_args, **_kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args) -> None:
        return None

    async def get(self, *_args, **_kwargs) -> FakeResponse:
        return FakeResponse()

    async def head(self, *_args, **_kwargs) -> FakeResponse:
        return FakeResponse()

    async def aclose(self) -> None:
        return None


def _technical(score: float) -> TechnicalAuditResult:
    return TechnicalAuditResult(
        score=score,
        is_https=True,
        ttfb_ms=100,
        has_sitemap=True,
        sitemap_url_count=1,
        has_robots_txt=True,
        ai_crawler_access={
            "GPTBot": "ALLOWED",
            "OAI-SearchBot": "ALLOWED",
            "PerplexityBot": "ALLOWED",
            "Google-Extended": "ALLOWED",
        },
        has_llmstxt=True,
        has_meta_robots_noindex=False,
        has_canonical=True,
        has_og_tags=True,
        has_mobile_viewport=True,
        x_robots_tag=None,
        score_crawlability=25,
        score_indexability=20,
        score_security=15,
        score_mobile=10,
        score_performance=15,
        score_ssr=15,
        issues=[],
    )


def _schema(score: float) -> SchemaAuditResult:
    return SchemaAuditResult(
        score=score,
        schema_types=["Organization", "WebSite"],
        has_organization=True,
        has_website=True,
        has_search_action=False,
        has_breadcrumbs=False,
        has_speakable=False,
        same_as_count=1,
        is_server_rendered=True,
        schema_objects=[],
        issues=[],
    )


def _llms(score: float) -> LlmsTxtResult:
    return LlmsTxtResult(
        score=score,
        has_llmstxt=True,
        has_llmstxt_full=False,
        llmstxt_url="https://example.com/llms.txt",
        section_count=1,
        link_count=1,
        valid_links=1,
        score_completeness=score,
        score_accuracy=score,
        score_usefulness=score,
        issues=[],
    )


def _content(score: float, *, ai_scored: bool = False) -> ContentQualityResult:
    return ContentQualityResult(
        score=score,
        word_count=500,
        heading_depth=3,
        paragraph_count=5,
        avg_sentence_length=12,
        statistical_density=5,
        has_author=True,
        has_publish_date=True,
        external_link_count=1,
        internal_link_count=1,
        score_experience=score / 4,
        score_expertise=score / 4,
        score_authoritativeness=score / 4,
        score_trustworthiness=score / 4,
        topical_authority_modifier=0,
        ai_scored=ai_scored,
        issues=[],
    )


def test_full_audit_uses_geo_seo_claude_weighting(monkeypatch) -> None:
    async def _run() -> None:
        async def _run_technical(*_args, **_kwargs):
            return _technical(60)

        async def _run_llms(*_args, **_kwargs):
            return _llms(100)

        async def _run_content(*_args, **_kwargs):
            return _content(50)

        monkeypatch.setattr(full_audit.httpx, "AsyncClient", FakeAsyncClient)
        monkeypatch.setattr(full_audit, "run_technical_audit", _run_technical)
        monkeypatch.setattr(
            full_audit, "run_schema_audit", lambda *_a, **_k: _schema(70)
        )
        monkeypatch.setattr(full_audit, "run_llmstxt_audit", _run_llms)
        monkeypatch.setattr(full_audit, "run_content_quality_audit", _run_content)
        monkeypatch.setattr(
            full_audit,
            "analyze_html_citability",
            lambda *_a, **_k: {"average_citability_score": 80},
        )
        monkeypatch.setattr(full_audit, "_run_brand_authority_audit", lambda *_a: 40)

        result = await full_audit.run_full_audit("https://example.com")

        platform = result.platforms.average
        expected = round(
            80 * 0.25 + 50 * 0.20 + 60 * 0.15 + 70 * 0.10 + platform * 0.10 + 40 * 0.20,
            1,
        )
        assert result.brand_authority == 40
        assert result.overall_geo_score == expected

    asyncio.run(_run())


def test_full_audit_module_timeout_falls_back(monkeypatch) -> None:
    async def _run() -> None:
        async def _never_returns(*_args, **_kwargs):
            await asyncio.sleep(1)

        async def _run_technical(*_args, **_kwargs):
            return _technical(60)

        async def _run_llms(*_args, **_kwargs):
            return _llms(100)

        monkeypatch.setattr(full_audit.httpx, "AsyncClient", FakeAsyncClient)
        monkeypatch.setitem(full_audit._MODULE_TIMEOUTS, "content", 0.01)
        monkeypatch.setattr(full_audit, "run_technical_audit", _run_technical)
        monkeypatch.setattr(
            full_audit, "run_schema_audit", lambda *_a, **_k: _schema(70)
        )
        monkeypatch.setattr(full_audit, "run_llmstxt_audit", _run_llms)
        monkeypatch.setattr(full_audit, "run_content_quality_audit", _never_returns)
        monkeypatch.setattr(
            full_audit,
            "analyze_html_citability",
            lambda *_a, **_k: {"average_citability_score": 80},
        )

        result = await full_audit.run_full_audit("https://example.com")

        assert result.content.score == 0
        assert result.content.ai_scored is False
        assert "timed out" in result.content.issues[0].message

    asyncio.run(_run())
