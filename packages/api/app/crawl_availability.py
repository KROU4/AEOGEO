"""Optional Crawl4AI + Playwright stack (install: uv sync --extra crawl; Docker: INSTALL_CRAWL=1)."""

from __future__ import annotations

import importlib.util


class CrawlStackUnavailableError(RuntimeError):
    """Raised when crawl4ai/playwright are not installed."""


def require_crawl_stack() -> None:
    """Ensure optional crawl dependencies are available; raise otherwise."""
    if importlib.util.find_spec("crawl4ai") is None:
        raise CrawlStackUnavailableError(
            "Website crawling requires the optional `crawl` extra: "
            "uv sync --extra crawl && uv run playwright install chromium "
            "(or build API image with INSTALL_CRAWL=1).",
        )
    if importlib.util.find_spec("playwright") is None:
        raise CrawlStackUnavailableError(
            "Website crawling requires the optional `crawl` extra: "
            "uv sync --extra crawl && uv run playwright install chromium "
            "(or build API image with INSTALL_CRAWL=1).",
        )
