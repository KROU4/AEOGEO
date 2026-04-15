"""Technical SEO + GEO audit — pure code, no AI calls."""

from __future__ import annotations

import asyncio
import time
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from geo_audit.models import AuditIssue, TechnicalAuditResult
from geo_audit.robots_parse import (
    AI_CRAWLERS,
    parse_robots_txt,
    status_implies_crawl_allowed,
)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_TIER1_CRAWLERS = ("GPTBot", "ClaudeBot", "PerplexityBot")


def _count_sitemap_urls(content: str) -> int:
    """Return number of <url> or <sitemap> entries in a sitemap XML."""
    try:
        root = ET.fromstring(content)
        ns = ""
        tag = root.tag
        if tag.startswith("{"):
            ns = tag[: tag.index("}") + 1]
        url_count = len(root.findall(f"{ns}url"))
        sitemap_count = len(root.findall(f"{ns}sitemap"))
        return url_count + sitemap_count
    except ET.ParseError:
        return 0


def _og_in_head(soup: BeautifulSoup) -> bool:
    head = soup.find("head")
    if not head:
        return False
    return bool(
        head.find("meta", property="og:title")
        or head.find("meta", attrs={"property": "og:title"})
    )


def _schema_in_head(soup: BeautifulSoup) -> bool:
    head = soup.find("head")
    if not head:
        return False
    return bool(head.find("script", type="application/ld+json"))


def _canonical_in_head(soup: BeautifulSoup) -> bool:
    head = soup.find("head")
    if not head:
        return False
    return bool(head.find("link", rel="canonical"))


async def run_technical_audit(
    url: str,
    html: str | None = None,
) -> TechnicalAuditResult:
    """Run full technical audit for a URL. html may be pre-fetched."""
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    is_https = parsed.scheme == "https"

    issues: list[AuditIssue] = []

    ttfb_ms: float | None = None
    fetched_html = html or ""
    homepage_status: int | None = None
    x_robots_tag: str | None = None

    robots_content: str | None = None
    sitemap_content: str | None = None
    sitemap_url_count = 0
    has_llmstxt = False

    async def _fetch_homepage() -> None:
        nonlocal fetched_html, ttfb_ms, homepage_status, x_robots_tag
        if html is not None:
            return
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS, follow_redirects=True, timeout=40.0
            ) as client:
                t0 = time.monotonic()
                r = await client.get(url)
                ttfb_ms = round((time.monotonic() - t0) * 1000, 1)
                homepage_status = r.status_code
                fetched_html = r.text
                x_robots_tag = r.headers.get("x-robots-tag")
        except httpx.HTTPError as exc:
            issues.append(
                AuditIssue(
                    severity="critical",
                    category="technical",
                    message=f"Failed to fetch homepage: {exc}",
                    recommendation="Ensure the URL is reachable and returns a 2xx status.",
                )
            )

    async def _fetch_robots() -> None:
        nonlocal robots_content
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS, follow_redirects=True, timeout=20.0
            ) as client:
                r = await client.get(f"{base}/robots.txt")
                if r.status_code == 200:
                    robots_content = r.text
        except httpx.HTTPError:
            pass

    async def _fetch_sitemap() -> None:
        nonlocal sitemap_content, sitemap_url_count
        candidates = [
            f"{base}/sitemap.xml",
            f"{base}/sitemap_index.xml",
            f"{base}/sitemap",
        ]
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS, follow_redirects=True, timeout=20.0
            ) as client:
                for candidate in candidates:
                    try:
                        r = await client.get(candidate)
                        if r.status_code == 200 and r.text.strip():
                            sitemap_content = r.text
                            sitemap_url_count = _count_sitemap_urls(r.text)
                            break
                    except httpx.HTTPError:
                        continue
        except Exception:
            pass

    async def _fetch_llmstxt() -> None:
        nonlocal has_llmstxt
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS, follow_redirects=True, timeout=15.0
            ) as client:
                r = await client.get(f"{base}/llms.txt")
                has_llmstxt = r.status_code == 200 and bool(r.text.strip())
        except httpx.HTTPError:
            has_llmstxt = False

    if html is not None:
        await asyncio.gather(
            _fetch_robots(),
            _fetch_sitemap(),
            _fetch_llmstxt(),
        )
        try:
            async with httpx.AsyncClient(
                headers=DEFAULT_HEADERS, follow_redirects=True, timeout=40.0
            ) as client:
                t0 = time.monotonic()
                r = await client.head(url)
                ttfb_ms = round((time.monotonic() - t0) * 1000, 1)
                x_robots_tag = r.headers.get("x-robots-tag")
        except httpx.HTTPError:
            pass
    else:
        await asyncio.gather(
            _fetch_homepage(),
            _fetch_robots(),
            _fetch_sitemap(),
            _fetch_llmstxt(),
        )

    soup = BeautifulSoup(fetched_html, "lxml") if fetched_html else BeautifulSoup("", "lxml")

    has_robots_txt = robots_content is not None
    ai_crawler_access: dict[str, str] = {}
    if robots_content:
        ai_crawler_access = parse_robots_txt(robots_content)
    else:
        for crawler in AI_CRAWLERS:
            ai_crawler_access[crawler] = "NO_ROBOTS_TXT"

    has_sitemap = sitemap_content is not None

    meta_robots = soup.find("meta", attrs={"name": lambda n: n and n.lower() == "robots"})
    has_meta_robots_noindex = False
    if meta_robots:
        content_val = meta_robots.get("content", "")
        if isinstance(content_val, str) and "noindex" in content_val.lower():
            has_meta_robots_noindex = True

    canonical_tag = soup.find("link", rel="canonical")
    has_canonical = canonical_tag is not None

    og_title = soup.find("meta", property="og:title") or soup.find(
        "meta", attrs={"property": "og:title"}
    )
    og_desc = soup.find("meta", property="og:description") or soup.find(
        "meta", attrs={"property": "og:description"}
    )
    og_image = soup.find("meta", property="og:image") or soup.find(
        "meta", attrs={"property": "og:image"}
    )
    has_og_tags = bool(og_title and og_desc and og_image)

    viewport_tag = soup.find("meta", attrs={"name": lambda n: n and n.lower() == "viewport"})
    has_mobile_viewport = viewport_tag is not None

    og_in_head = _og_in_head(soup)
    schema_in_head = _schema_in_head(soup)
    canonical_in_head = _canonical_in_head(soup)

    # --- Scoring ---
    score_crawlability = 0.0
    tier1_allowed = 0
    for bot in _TIER1_CRAWLERS:
        status = ai_crawler_access.get(bot, "NOT_MENTIONED")
        if status_implies_crawl_allowed(status):
            tier1_allowed += 1
    score_crawlability += tier1_allowed * 5.0
    if has_sitemap:
        score_crawlability += 5.0
    if has_llmstxt:
        score_crawlability += 5.0
    score_crawlability = min(score_crawlability, 25.0)

    score_indexability = 0.0
    if not has_meta_robots_noindex:
        score_indexability += 10.0
    if has_canonical:
        score_indexability += 5.0
    if sitemap_url_count > 0:
        score_indexability += 5.0
    score_indexability = min(score_indexability, 20.0)

    score_security = 0.0
    if is_https:
        score_security += 10.0
    x_robots_blocks = False
    if x_robots_tag and "noindex" in x_robots_tag.lower():
        x_robots_blocks = True
    if not x_robots_blocks:
        score_security += 5.0
    score_security = min(score_security, 15.0)

    score_mobile = 10.0 if has_mobile_viewport else 0.0

    score_performance = 0.0
    if ttfb_ms is not None:
        if ttfb_ms < 800:
            score_performance = 15.0
        elif ttfb_ms < 1500:
            score_performance = 10.0
        elif ttfb_ms < 3000:
            score_performance = 5.0

    score_ssr = 0.0
    if og_in_head:
        score_ssr += 5.0
    if schema_in_head:
        score_ssr += 5.0
    if canonical_in_head:
        score_ssr += 5.0

    total_score = (
        score_crawlability
        + score_indexability
        + score_security
        + score_mobile
        + score_performance
        + score_ssr
    )

    # --- Issue collection ---
    if not is_https:
        issues.append(
            AuditIssue(
                severity="critical",
                category="technical",
                message="Site is not served over HTTPS.",
                recommendation="Enable HTTPS with a valid SSL/TLS certificate.",
            )
        )

    if not has_robots_txt:
        issues.append(
            AuditIssue(
                severity="warning",
                category="crawler",
                message="No robots.txt found.",
                recommendation="Create a robots.txt to control crawler access.",
            )
        )

    for bot in _TIER1_CRAWLERS:
        status = ai_crawler_access.get(bot, "NOT_MENTIONED")
        if not status_implies_crawl_allowed(status):
            issues.append(
                AuditIssue(
                    severity="critical",
                    category="crawler",
                    message=f"{bot} is blocked by robots.txt.",
                    recommendation=f"Allow {bot} in robots.txt so AI engines can index your content.",
                )
            )

    if not has_sitemap:
        issues.append(
            AuditIssue(
                severity="warning",
                category="technical",
                message="No XML sitemap found at /sitemap.xml or /sitemap_index.xml.",
                recommendation="Create and submit a sitemap to improve crawler discovery.",
            )
        )

    if not has_llmstxt:
        issues.append(
            AuditIssue(
                severity="warning",
                category="llmstxt",
                message="No llms.txt found at /llms.txt.",
                recommendation="Add an llms.txt file to help AI crawlers understand your site.",
            )
        )

    if has_meta_robots_noindex:
        issues.append(
            AuditIssue(
                severity="critical",
                category="technical",
                message="Page has <meta name='robots' content='noindex'>.",
                recommendation="Remove noindex from meta robots to allow indexing.",
            )
        )

    if not has_canonical:
        issues.append(
            AuditIssue(
                severity="warning",
                category="technical",
                message="No canonical tag found.",
                recommendation="Add <link rel='canonical'> to prevent duplicate content issues.",
            )
        )

    if not has_og_tags:
        issues.append(
            AuditIssue(
                severity="info",
                category="technical",
                message="Missing one or more Open Graph tags (og:title, og:description, og:image).",
                recommendation="Add complete OG tags for better social sharing and AI understanding.",
            )
        )

    if not has_mobile_viewport:
        issues.append(
            AuditIssue(
                severity="warning",
                category="technical",
                message="No mobile viewport meta tag found.",
                recommendation="Add <meta name='viewport' content='width=device-width, initial-scale=1'>.",
            )
        )

    if x_robots_blocks:
        issues.append(
            AuditIssue(
                severity="critical",
                category="technical",
                message=f"X-Robots-Tag header contains noindex: {x_robots_tag}",
                recommendation="Remove noindex from the X-Robots-Tag HTTP header.",
            )
        )

    if ttfb_ms is not None and ttfb_ms >= 3000:
        issues.append(
            AuditIssue(
                severity="warning",
                category="technical",
                message=f"Slow time to first byte: {ttfb_ms:.0f}ms (target < 800ms).",
                recommendation="Optimize server response time with caching and CDN.",
            )
        )

    if not og_in_head and fetched_html:
        issues.append(
            AuditIssue(
                severity="info",
                category="technical",
                message="OG tags not found in <head> — may indicate client-side rendering.",
                recommendation="Ensure OG tags are server-rendered in <head> for AI crawlers.",
            )
        )

    if not schema_in_head and fetched_html:
        issues.append(
            AuditIssue(
                severity="info",
                category="schema",
                message="JSON-LD schema not found in <head> — may not be server-rendered.",
                recommendation="Move JSON-LD scripts to <head> for reliable crawler parsing.",
            )
        )

    return TechnicalAuditResult(
        score=round(min(total_score, 100.0), 1),
        is_https=is_https,
        ttfb_ms=ttfb_ms,
        has_sitemap=has_sitemap,
        sitemap_url_count=sitemap_url_count,
        has_robots_txt=has_robots_txt,
        ai_crawler_access=ai_crawler_access,
        has_llmstxt=has_llmstxt,
        has_meta_robots_noindex=has_meta_robots_noindex,
        has_canonical=has_canonical,
        has_og_tags=has_og_tags,
        has_mobile_viewport=has_mobile_viewport,
        x_robots_tag=x_robots_tag,
        score_crawlability=score_crawlability,
        score_indexability=score_indexability,
        score_security=score_security,
        score_mobile=score_mobile,
        score_performance=score_performance,
        score_ssr=score_ssr,
        issues=issues,
    )
