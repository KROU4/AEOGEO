"""Single-purpose website crawl for onboarding (no knowledge-base persistence)."""

from __future__ import annotations

import logging
from uuid import UUID

from app.crawl_availability import require_crawl_stack

logger = logging.getLogger(__name__)


async def crawl_website_pages(
    brand_id: UUID,
    url: str,
    *,
    max_depth: int = 3,
    max_pages: int = 50,
) -> dict:
    """Crawl a site with Crawl4AI; same shape as the former IngestionService.crawl_website."""
    require_crawl_stack()
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

    pages: list[dict] = []
    visited: set[str] = set()
    to_visit: list[tuple[str, int]] = [(url, 0)]
    errors: list[str] = []

    browser_config = BrowserConfig(headless=True, verbose=False)

    logger.info(
        "Homepage crawl for brand %s: url=%s max_depth=%d max_pages=%d",
        brand_id,
        url,
        max_depth,
        max_pages,
    )

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            while to_visit and len(pages) < max_pages:
                current_url, depth = to_visit.pop(0)

                if current_url in visited:
                    continue
                visited.add(current_url)

                try:
                    run_config = CrawlerRunConfig(
                        page_timeout=30000,
                        wait_until="domcontentloaded",
                    )
                    result = await crawler.arun(
                        url=current_url, config=run_config
                    )

                    if result.success:
                        content = str(result.markdown) if result.markdown else ""
                        if not content and result.cleaned_html:
                            content = result.cleaned_html

                        page_data = {
                            "url": current_url,
                            "title": (
                                result.metadata.get("title", "")
                                if result.metadata
                                else ""
                            ),
                            "content": content,
                            "status": "success",
                        }
                        pages.append(page_data)

                        if depth < max_depth and result.links:
                            internal_links = result.links.get("internal", [])
                            for link in internal_links:
                                link_url = (
                                    link.get("href", "")
                                    if isinstance(link, dict)
                                    else str(link)
                                )
                                if link_url and link_url not in visited:
                                    to_visit.append((link_url, depth + 1))
                    else:
                        error_msg = result.error_message or "Unknown error"
                        pages.append(
                            {
                                "url": current_url,
                                "title": "",
                                "content": "",
                                "status": "failed",
                                "error": error_msg,
                            }
                        )
                        errors.append(f"{current_url}: {error_msg}")

                except Exception as e:
                    logger.warning("Failed to crawl %s: %s", current_url, e)
                    pages.append(
                        {
                            "url": current_url,
                            "title": "",
                            "content": "",
                            "status": "failed",
                            "error": str(e),
                        }
                    )
                    errors.append(f"{current_url}: {e}")

    except Exception as e:
        logger.error("Crawler initialization failed: %s", e)
        errors.append(f"Crawler init error: {e}")

    successful = sum(1 for p in pages if p.get("status") == "success")
    return {
        "pages": pages,
        "total_pages": len(pages),
        "successful_pages": successful,
        "failed_pages": len(pages) - successful,
        "errors": errors,
    }
