"""Async native quick audit (no upstream repo clone required)."""

from __future__ import annotations

from urllib.parse import urlparse

import httpx

from geo_audit.citability_core import analyze_html_citability
from geo_audit.models import QuickAuditResult
from geo_audit.robots_parse import parse_robots_txt, status_implies_crawl_allowed
from geo_audit.schema_extract import extract_schema_org_types

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

WATCH_BOTS = ("GPTBot", "ClaudeBot", "PerplexityBot")


def _normalize_url(url: str) -> str:
    u = url.strip()
    if not u:
        return u
    if not u.startswith(("http://", "https://")):
        u = f"https://{u}"
    return u


def _schema_strength(types: list[str]) -> float:
    if not types:
        return 0.0
    return min(100.0, 15.0 * min(len(types), 6))


def _overall_score(
    citability: float,
    bot_allowed: list[bool],
    has_llms: bool,
    schema_score: float,
) -> float:
    crawl_frac = sum(1 for x in bot_allowed if x) / max(len(bot_allowed), 1)
    crawl_part = crawl_frac * 100.0
    llms_part = 100.0 if has_llms else 0.0
    return round(
        0.38 * citability + 0.22 * crawl_part + 0.15 * llms_part + 0.25 * schema_score,
        1,
    )


def _build_issues_and_tips(
    *,
    fetch_error: str | None,
    citability: float,
    bots: dict[str, bool],
    has_llms: bool,
    schema_types: list[str],
) -> tuple[list[str], list[str]]:
    issues: list[str] = []
    tips: list[str] = []

    if fetch_error:
        issues.append(f"Could not fully fetch the page: {fetch_error}")

    if citability < 45:
        issues.append(
            "Main content blocks score low for AI citability (structure & facts)."
        )

    for name, ok in bots.items():
        if not ok:
            issues.append(f"robots.txt may block or restrict {name}.")

    if not has_llms:
        issues.append(
            "No llms.txt detected at /llms.txt (helps AI crawlers understand your site)."
        )

    if not schema_types:
        issues.append(
            "No JSON-LD structured data found (Organization/WebSite helps entity clarity)."
        )

    if len(issues) < 5 and citability < 65:
        issues.append(
            "Passages are not in the 134–167 word “highly citable” window often enough."
        )

    if not has_llms and len(tips) < 3:
        tips.append(
            "Publish llms.txt at /.well-known/ or /llms.txt with site summary and key URLs."
        )

    if schema_types:
        if "Organization" not in schema_types and "LocalBusiness" not in schema_types:
            tips.append(
                "Add Organization (or LocalBusiness) JSON-LD with sameAs links to profiles."
            )
    else:
        tips.append(
            "Add Organization + WebSite JSON-LD including logo and social sameAs."
        )

    if not all(bots.values()) and len(tips) < 3:
        tips.append(
            "Adjust robots.txt so major AI crawlers can access content you want cited."
        )

    if citability < 55 and len(tips) < 3:
        tips.append(
            "Rewrite key sections as self-contained answer blocks with stats and definitions."
        )

    return issues[:5], tips[:3]


async def run_quick_audit_native(url: str) -> QuickAuditResult:
    target = _normalize_url(url)
    if not target:
        raise ValueError("url is required")

    parsed = urlparse(target)
    base = f"{parsed.scheme}://{parsed.netloc}"

    fetch_error: str | None = None
    html = ""
    robots_status: dict[str, str] = {}
    async with httpx.AsyncClient(
        headers=DEFAULT_HEADERS, follow_redirects=True, timeout=40.0
    ) as client:
        try:
            r = await client.get(target)
            r.raise_for_status()
            html = r.text
        except httpx.HTTPError as exc:
            fetch_error = str(exc)

        try:
            robots_url = f"{base}/robots.txt"
            rr = await client.get(robots_url, timeout=15.0)
            if rr.status_code == 200:
                robots_status = parse_robots_txt(rr.text)
            else:
                for c in WATCH_BOTS:
                    robots_status[c] = "NO_ROBOTS_TXT"
        except httpx.HTTPError:
            for c in WATCH_BOTS:
                robots_status[c] = "NO_ROBOTS_TXT"

        has_llms = False
        try:
            lr = await client.get(f"{base}/llms.txt", timeout=12.0)
            has_llms = lr.status_code == 200 and bool(lr.text.strip())
        except httpx.HTTPError:
            has_llms = False

    cit_result = (
        analyze_html_citability(html) if html else {"average_citability_score": 0.0}
    )
    citability = float(cit_result.get("average_citability_score", 0.0))

    schema_types = extract_schema_org_types(html) if html else []
    schema_score = _schema_strength(schema_types)

    bots_bool: dict[str, bool] = {}
    for name in WATCH_BOTS:
        st = robots_status.get(name, "NOT_MENTIONED")
        if st == "NO_ROBOTS_TXT":
            bots_bool[name] = True
        else:
            bots_bool[name] = status_implies_crawl_allowed(st)

    overall = _overall_score(
        citability,
        [bots_bool[b] for b in WATCH_BOTS],
        has_llms,
        schema_score,
    )

    issues, tips = _build_issues_and_tips(
        fetch_error=fetch_error,
        citability=citability,
        bots=bots_bool,
        has_llms=has_llms,
        schema_types=schema_types,
    )

    if fetch_error and overall > 0:
        overall = min(overall, 35.0)

    return QuickAuditResult(
        overall_geo_score=min(100.0, max(0.0, overall)),
        citability_score=min(100.0, max(0.0, citability)),
        ai_crawler_access=bots_bool,
        has_llms_txt=has_llms,
        schema_org={"types": schema_types},
        top_issues=issues[:5],
        top_recommendations=tips[:3],
    )
