"""llms.txt audit and template generation — pure code, no AI calls."""

from __future__ import annotations

import asyncio
import random
import re
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import httpx

from geo_audit.models import AuditIssue, LlmsTxtResult

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/plain,text/html,*/*;q=0.8",
}

_LINK_RE = re.compile(r"^\s*-\s*\[.+?\]\((.+?)\)", re.MULTILINE)
_BARE_LINK_RE = re.compile(r"^\s*>\s*(https?://\S+)", re.MULTILINE)


def _parse_llmstxt(content: str) -> tuple[int, int, list[str], bool, bool, bool]:
    """Return (section_count, link_count, link_urls, has_title, has_sections, has_description)."""
    lines = content.splitlines()
    has_title = any(line.startswith("# ") and not line.startswith("## ") for line in lines)
    sections = [line for line in lines if line.startswith("## ")]
    section_count = len(sections)

    link_urls: list[str] = []
    for m in _LINK_RE.finditer(content):
        link_urls.append(m.group(1))
    for m in _BARE_LINK_RE.finditer(content):
        link_urls.append(m.group(1))

    has_description = False
    if has_title:
        for line in lines[1:]:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("-"):
                if len(stripped.split()) >= 5:
                    has_description = True
                    break

    return section_count, len(link_urls), link_urls, has_title, bool(section_count), has_description


def _link_path_depth(url: str) -> int:
    try:
        parts = urlparse(url).path.strip("/").split("/")
        return len([p for p in parts if p])
    except Exception:
        return 0


def _diverse_paths(link_urls: list[str]) -> bool:
    """True if links cover at least 3 different path depths."""
    depths = {_link_path_depth(u) for u in link_urls}
    return len(depths) >= 3


def _links_have_context(content: str, link_urls: list[str]) -> bool:
    """True if most link lines have a description (text after the link)."""
    if not link_urls:
        return False
    described = 0
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("- ["):
            if "](" in stripped:
                after_link = stripped[stripped.rfind(")") + 1:].strip()
                if len(after_link.split()) >= 3:
                    described += 1
    return described >= max(1, len(link_urls) // 2)


async def _check_links_valid(
    link_urls: list[str],
    client: httpx.AsyncClient,
    sample_size: int = 10,
) -> int:
    """Return count of sampled links that return HTTP 2xx."""
    sample = random.sample(link_urls, min(sample_size, len(link_urls)))

    async def _check(url: str) -> bool:
        try:
            r = await client.head(url, timeout=10.0)
            if r.status_code == 405:
                r = await client.get(url, timeout=10.0)
            return 200 <= r.status_code < 300
        except Exception:
            return False

    results = await asyncio.gather(*(_check(u) for u in sample))
    if not results:
        return 0
    valid_ratio = sum(1 for r in results if r) / len(results)
    return round(valid_ratio * len(link_urls))


async def _get_sitemap_urls(base: str, client: httpx.AsyncClient, limit: int = 10) -> list[str]:
    """Fetch top URLs from sitemap for template generation."""
    for candidate in (f"{base}/sitemap.xml", f"{base}/sitemap_index.xml"):
        try:
            r = await client.get(candidate, timeout=15.0)
            if r.status_code != 200 or not r.text.strip():
                continue
            try:
                root = ET.fromstring(r.text)
                ns = ""
                tag = root.tag
                if tag.startswith("{"):
                    ns = tag[: tag.index("}") + 1]
                urls: list[str] = []
                for loc in root.findall(f".//{ns}loc"):
                    if loc.text:
                        urls.append(loc.text.strip())
                return urls[:limit]
            except ET.ParseError:
                continue
        except httpx.HTTPError:
            continue
    return []


def _generate_template(base: str, site_title: str, sitemap_urls: list[str]) -> str:
    """Generate a minimal llms.txt template."""
    lines = [f"# {site_title}", "", f"> {base} — AI-readable site overview.", ""]

    if sitemap_urls:
        lines.append("## Key Pages")
        lines.append("")
        for url in sitemap_urls[:10]:
            path = urlparse(url).path.strip("/") or "home"
            label = path.replace("/", " › ").replace("-", " ").replace("_", " ").title() or "Home"
            lines.append(f"- [{label}]({url})")
        lines.append("")

    lines.append("## About")
    lines.append("")
    lines.append(f"- [About Us]({base}/about)")
    lines.append(f"- [Contact]({base}/contact)")

    return "\n".join(lines)


async def run_llmstxt_audit(url: str) -> LlmsTxtResult:
    """Fetch and validate llms.txt for the given URL."""
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    issues: list[AuditIssue] = []

    llmstxt_content: str | None = None
    llmstxt_url: str | None = None
    has_llmstxt = False
    has_llmstxt_full = False

    async with httpx.AsyncClient(
        headers=DEFAULT_HEADERS, follow_redirects=True, timeout=30.0
    ) as client:
        for candidate in (f"{base}/llms.txt", f"{base}/llms-full.txt"):
            try:
                r = await client.get(candidate, timeout=15.0)
                if r.status_code == 200 and r.text.strip():
                    if candidate.endswith("llms-full.txt"):
                        has_llmstxt_full = True
                        if llmstxt_content is None:
                            llmstxt_content = r.text
                            llmstxt_url = candidate
                    else:
                        has_llmstxt = True
                        llmstxt_content = r.text
                        llmstxt_url = candidate
            except httpx.HTTPError:
                continue

        generated_template: str | None = None
        if not has_llmstxt and not has_llmstxt_full:
            issues.append(
                AuditIssue(
                    severity="critical",
                    category="llmstxt",
                    message="No llms.txt found at /llms.txt or /llms-full.txt.",
                    recommendation="Create an llms.txt file to help AI systems understand your site.",
                )
            )
            sitemap_urls = await _get_sitemap_urls(base, client)
            try:
                r = await client.get(base, timeout=15.0)
                from bs4 import BeautifulSoup  # noqa: PLC0415
                soup = BeautifulSoup(r.text, "lxml")
                title_tag = soup.find("title")
                site_title = title_tag.get_text(strip=True) if title_tag else parsed.netloc
            except Exception:
                site_title = parsed.netloc
            generated_template = _generate_template(base, site_title, sitemap_urls)
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
                issues=issues,
                generated_template=generated_template,
            )

        content = llmstxt_content or ""
        section_count, link_count, link_urls, has_title, has_sections, has_description = (
            _parse_llmstxt(content)
        )

        valid_links = 0
        if link_urls:
            valid_links = await _check_links_valid(link_urls, client)

        # Completeness score
        score_completeness = 0.0
        if has_title:
            score_completeness += 20.0
        if has_sections:
            score_completeness += 30.0
        if link_count > 0:
            score_completeness += 30.0
        if link_count > 5:
            score_completeness += 20.0

        # Accuracy score
        score_accuracy = 0.0
        if link_count > 0:
            score_accuracy = round((valid_links / link_count) * 100.0, 1)

        # Usefulness score
        score_usefulness = 0.0
        if has_description:
            score_usefulness += 30.0
        if link_urls and _diverse_paths(link_urls):
            score_usefulness += 40.0
        if link_urls and _links_have_context(content, link_urls):
            score_usefulness += 30.0

        overall_score = round(
            score_completeness * 0.40
            + score_accuracy * 0.35
            + score_usefulness * 0.25,
            1,
        )

    if not has_title:
        issues.append(
            AuditIssue(
                severity="warning",
                category="llmstxt",
                message="llms.txt has no H1 title line (# Title).",
                recommendation="Add a top-level # title to describe the site.",
            )
        )

    if not has_sections:
        issues.append(
            AuditIssue(
                severity="warning",
                category="llmstxt",
                message="llms.txt has no section headers (## Section).",
                recommendation="Organize llms.txt with ## sections for key site areas.",
            )
        )

    if link_count == 0:
        issues.append(
            AuditIssue(
                severity="critical",
                category="llmstxt",
                message="llms.txt has no link entries.",
                recommendation="Add - [Label](URL) entries to guide AI crawlers to key pages.",
            )
        )

    if link_count > 0 and valid_links < link_count:
        broken = link_count - valid_links
        issues.append(
            AuditIssue(
                severity="warning",
                category="llmstxt",
                message=f"{broken} link(s) in llms.txt may be broken or unreachable.",
                recommendation="Verify all URLs in llms.txt return 200 OK.",
            )
        )

    if not has_description:
        issues.append(
            AuditIssue(
                severity="info",
                category="llmstxt",
                message="llms.txt lacks a description paragraph after the title.",
                recommendation="Add a short description (> blockquote or paragraph) after the title.",
            )
        )

    return LlmsTxtResult(
        score=min(overall_score, 100.0),
        has_llmstxt=has_llmstxt,
        has_llmstxt_full=has_llmstxt_full,
        llmstxt_url=llmstxt_url,
        section_count=section_count,
        link_count=link_count,
        valid_links=valid_links,
        score_completeness=score_completeness,
        score_accuracy=score_accuracy,
        score_usefulness=score_usefulness,
        issues=issues,
        generated_template=None,
    )
