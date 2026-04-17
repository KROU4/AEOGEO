from __future__ import annotations

import asyncio

from geo_audit.quick_native import run_quick_audit_native


class FakeResponse:
    def __init__(self, status_code: int, text: str = "") -> None:
        self.status_code = status_code
        self.text = text

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeAsyncClient:
    routes: dict[str, FakeResponse] = {}

    def __init__(self, *_args, **_kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args) -> None:
        return None

    async def get(self, url: str, **_kwargs) -> FakeResponse:
        return self.routes.get(url, FakeResponse(404, ""))


def test_quick_audit_scores_ai_infrastructure_ready(monkeypatch) -> None:
    async def _run() -> None:
        FakeAsyncClient.routes = {
            "https://example.com": FakeResponse(
                200, "<html><title>Example</title></html>"
            ),
            "https://example.com/robots.txt": FakeResponse(
                200,
                "\n".join(
                    [
                        "User-agent: GPTBot",
                        "Allow: /",
                        "User-agent: ClaudeBot",
                        "Allow: /",
                        "User-agent: PerplexityBot",
                        "Allow: /",
                        "Sitemap: https://example.com/sitemap.xml",
                    ]
                ),
            ),
            "https://example.com/llms.txt": FakeResponse(
                200,
                "# Example\n\n> Example company overview\n\n## Key Pages\n- [Home](https://example.com/)",
            ),
            "https://example.com/sitemap.xml": FakeResponse(
                200,
                "<?xml version='1.0'?><urlset><url><loc>https://example.com/</loc></url></urlset>",
            ),
        }
        monkeypatch.setattr("geo_audit.quick_native.httpx.AsyncClient", FakeAsyncClient)

        result = await run_quick_audit_native("https://example.com")

        assert result.overall_geo_score == 22
        assert result.readiness_label == "AI crawler ready"
        assert result.has_llms_txt is True
        assert result.has_sitemap is True
        assert result.robots_txt_status == "ai_ready"
        assert all(check.passed for check in result.infrastructure_checks)

    asyncio.run(_run())


def test_quick_audit_flags_missing_ai_files(monkeypatch) -> None:
    async def _run() -> None:
        FakeAsyncClient.routes = {
            "https://example.com": FakeResponse(
                200, "<html><title>Example</title></html>"
            ),
        }
        monkeypatch.setattr("geo_audit.quick_native.httpx.AsyncClient", FakeAsyncClient)

        result = await run_quick_audit_native("https://example.com")

        assert result.overall_geo_score == 0
        assert result.readiness_label == "AI crawlers are mostly blind"
        assert result.has_llms_txt is False
        assert result.has_sitemap is False
        assert result.robots_txt_status == "missing"
        assert "No llms.txt" in " ".join(result.top_issues)
        assert result.top_recommendations

    asyncio.run(_run())
