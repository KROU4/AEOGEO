"""Async native quick audit focused on AI-crawler infrastructure."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import httpx

from geo_audit.models import InfrastructureCheck, QuickAuditResult
from geo_audit.robots_parse import parse_robots_txt, status_implies_crawl_allowed

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

WATCH_BOTS = ("GPTBot", "ClaudeBot", "PerplexityBot")
SITEMAP_CANDIDATES = ("sitemap.xml", "sitemap_index.xml", "sitemap")


def _normalize_url(url: str) -> str:
    u = url.strip()
    if not u:
        return u
    if not u.startswith(("http://", "https://")):
        u = f"https://{u}"
    return u


def _count_sitemap_urls(content: str) -> int:
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return 0
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag[: root.tag.index("}") + 1]
    return len(root.findall(f".//{ns}url")) + len(root.findall(f".//{ns}sitemap"))


def _llms_quality(content: str) -> tuple[bool, str]:
    stripped = content.strip()
    if not stripped:
        return False, "llms.txt is empty."
    has_title = bool(re.search(r"(?m)^#\s+\S+", stripped))
    has_section = bool(re.search(r"(?m)^##\s+\S+", stripped))
    has_link = bool(re.search(r"(?m)^-\s*\[.+?\]\(.+?\)", stripped))
    if has_title and has_section and has_link:
        return True, "llms.txt is present and has title, sections, and key links."

    missing = []
    if not has_title:
        missing.append("title")
    if not has_section:
        missing.append("sections")
    if not has_link:
        missing.append("links")
    return False, f"llms.txt exists but is missing {', '.join(missing)}."


def _readiness_label(score: float) -> str:
    if score >= 20:
        return "AI crawler ready"
    if score >= 14:
        return "Good foundation"
    if score >= 7:
        return "Partial setup"
    return "AI crawlers are mostly blind"


def _build_issues_and_tips(
    *,
    fetch_error: str | None,
    bots: dict[str, bool],
    has_llms: bool,
    llms_well_formed: bool,
    has_sitemap: bool,
    robots_exists: bool,
    robots_has_sitemap: bool,
) -> tuple[list[str], list[str]]:
    issues: list[str] = []
    tips: list[str] = []

    if fetch_error:
        issues.append(f"Could not fully fetch the homepage: {fetch_error}")

    for name, ok in bots.items():
        if not ok:
            issues.append(f"robots.txt blocks or restricts {name}.")

    if not robots_exists:
        issues.append("No robots.txt found, so crawler rules are unclear.")
    elif not robots_has_sitemap:
        issues.append("robots.txt does not point crawlers to a sitemap.")

    if not has_llms:
        issues.append(
            "No llms.txt found at /llms.txt, so AI systems lack a site briefing."
        )
    elif not llms_well_formed:
        issues.append(
            "llms.txt exists but is incomplete; AI crawlers need sections and key links."
        )

    if not has_sitemap:
        issues.append("No XML sitemap found at the standard sitemap locations.")

    if has_llms and llms_well_formed and all(bots.values()) and has_sitemap:
        issues.append("Core AI crawler files are discoverable and readable.")

    if not has_llms:
        tips.append(
            "Publish /llms.txt with a short site summary and links to your key pages."
        )

    if not robots_exists or not all(bots.values()) or not robots_has_sitemap:
        tips.append(
            "Update robots.txt to allow major AI crawlers and include a Sitemap directive."
        )

    if not has_sitemap:
        tips.append("Generate and expose /sitemap.xml so crawlers can discover pages.")

    return issues[:5], tips[:3]


async def run_quick_audit_native(url: str) -> QuickAuditResult:
    target = _normalize_url(url)
    if not target:
        raise ValueError("url is required")

    parsed = urlparse(target)
    base = f"{parsed.scheme}://{parsed.netloc}"

    fetch_error: str | None = None
    robots_status: dict[str, str] = {}
    robots_exists = False
    robots_has_sitemap = False
    has_sitemap = False
    sitemap_url_count = 0
    has_llms = False
    llms_well_formed = False
    llms_details = "No llms.txt found at /llms.txt."

    async with httpx.AsyncClient(
        headers=DEFAULT_HEADERS, follow_redirects=True, timeout=15.0
    ) as client:
        try:
            r = await client.get(target, timeout=8.0)
            r.raise_for_status()
        except httpx.HTTPError as exc:
            fetch_error = str(exc)

        try:
            rr = await client.get(f"{base}/robots.txt", timeout=8.0)
            if rr.status_code == 200:
                robots_exists = True
                robots_status = parse_robots_txt(rr.text)
                robots_has_sitemap = bool(re.search(r"(?im)^sitemap\s*:", rr.text))
            else:
                for crawler in WATCH_BOTS:
                    robots_status[crawler] = "NO_ROBOTS_TXT"
        except httpx.HTTPError:
            for crawler in WATCH_BOTS:
                robots_status[crawler] = "NO_ROBOTS_TXT"

        try:
            lr = await client.get(f"{base}/llms.txt", timeout=8.0)
            has_llms = lr.status_code == 200 and bool(lr.text.strip())
            if has_llms:
                llms_well_formed, llms_details = _llms_quality(lr.text)
        except httpx.HTTPError:
            has_llms = False

        for name in SITEMAP_CANDIDATES:
            try:
                sr = await client.get(f"{base}/{name}", timeout=8.0)
                if sr.status_code == 200 and sr.text.strip():
                    count = _count_sitemap_urls(sr.text)
                    if count > 0:
                        has_sitemap = True
                        sitemap_url_count = count
                        break
            except httpx.HTTPError:
                continue

    bots_bool: dict[str, bool] = {}
    for name in WATCH_BOTS:
        status = robots_status.get(name, "NOT_MENTIONED")
        if status == "NO_ROBOTS_TXT":
            bots_bool[name] = True
        else:
            bots_bool[name] = status_implies_crawl_allowed(status)

    crawler_allowed = all(bots_bool.values())
    llms_score = 7.0 if has_llms and llms_well_formed else 3.0 if has_llms else 0.0
    robots_score = (
        9.0
        if robots_exists and crawler_allowed and robots_has_sitemap
        else 4.0
        if robots_exists and crawler_allowed
        else 0.0
    )
    sitemap_score = 6.0 if has_sitemap else 0.0
    overall = round(llms_score + robots_score + sitemap_score, 1)

    infrastructure_checks = [
        InfrastructureCheck(
            key="llms_txt",
            label="llms.txt AI brief",
            passed=has_llms and llms_well_formed,
            score=llms_score,
            details=llms_details,
        ),
        InfrastructureCheck(
            key="robots_txt",
            label="AI crawler access",
            passed=robots_exists and crawler_allowed and robots_has_sitemap,
            score=robots_score,
            details=(
                "robots.txt allows GPTBot, ClaudeBot, and PerplexityBot and includes a Sitemap directive."
                if robots_exists and crawler_allowed and robots_has_sitemap
                else "robots.txt should allow major AI crawlers and point them to your sitemap."
            ),
        ),
        InfrastructureCheck(
            key="sitemap",
            label="Sitemap discovery",
            passed=has_sitemap,
            score=sitemap_score,
            details=(
                f"XML sitemap found with {sitemap_url_count} discoverable entries."
                if has_sitemap
                else "No valid XML sitemap found at /sitemap.xml or /sitemap_index.xml."
            ),
        ),
    ]

    issues, tips = _build_issues_and_tips(
        fetch_error=fetch_error,
        bots=bots_bool,
        has_llms=has_llms,
        llms_well_formed=llms_well_formed,
        has_sitemap=has_sitemap,
        robots_exists=robots_exists,
        robots_has_sitemap=robots_has_sitemap,
    )

    return QuickAuditResult(
        overall_geo_score=min(100.0, max(0.0, overall)),
        citability_score=min(100.0, max(0.0, overall * 2.5)),
        ai_crawler_access=bots_bool,
        has_llms_txt=has_llms,
        has_sitemap=has_sitemap,
        sitemap_url_count=sitemap_url_count,
        robots_txt_status=(
            "ai_ready"
            if robots_exists and crawler_allowed and robots_has_sitemap
            else "needs_work"
            if robots_exists
            else "missing"
        ),
        llms_txt_status=(
            "well_formed"
            if has_llms and llms_well_formed
            else "incomplete"
            if has_llms
            else "missing"
        ),
        infrastructure_checks=infrastructure_checks,
        readiness_label=_readiness_label(overall),
        schema_org={"quick_check": "llms.txt, robots.txt, sitemap", "max_score": 40},
        top_issues=issues[:5],
        top_recommendations=tips[:3],
    )
