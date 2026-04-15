"""Run upstream geo-seo-claude Python scripts when GEO_SEO_CLAUDE_HOME is set."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from geo_audit.models import QuickAuditResult
from geo_audit.robots_parse import status_implies_crawl_allowed

WATCH_BOTS = ("GPTBot", "ClaudeBot", "PerplexityBot")


def _types_from_structured_data(items: list[Any]) -> list[str]:
    types: set[str] = set()

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            t = obj.get("@type")
            if isinstance(t, str):
                types.add(t)
            elif isinstance(t, list):
                types.update(str(x) for x in t)
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for x in obj:
                walk(x)

    for item in items:
        walk(item)
    return sorted(types)


def _overall_from_parts(
    citability: float,
    bots_bool: dict[str, bool],
    has_llms: bool,
    schema_score: float,
) -> float:
    crawl_frac = sum(1 for b in WATCH_BOTS if bots_bool.get(b)) / len(WATCH_BOTS)
    crawl_part = crawl_frac * 100.0
    llms_part = 100.0 if has_llms else 0.0
    return round(
        0.38 * citability + 0.22 * crawl_part + 0.15 * llms_part + 0.25 * schema_score,
        1,
    )


def _schema_strength(types: list[str]) -> float:
    if not types:
        return 0.0
    return min(100.0, 15.0 * min(len(types), 6))


async def run_quick_audit_subprocess(repo_root: Path, url: str) -> QuickAuditResult:
    """Invoke scripts/citability_scorer.py and scripts/fetch_page.py from a cloned repo."""
    py = sys.executable
    cit_script = repo_root / "scripts" / "citability_scorer.py"
    fetch_script = repo_root / "scripts" / "fetch_page.py"
    if not cit_script.is_file() or not fetch_script.is_file():
        raise FileNotFoundError(
            "geo-seo-claude scripts not found under GEO_SEO_CLAUDE_HOME"
        )

    async def _run(args: list[str]) -> str:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(repo_root),
        )
        out, err = await proc.communicate()
        if proc.returncode != 0:
            msg = err.decode("utf-8", errors="replace")[:800]
            raise RuntimeError(f"script failed: {msg}")
        return out.decode("utf-8", errors="replace")

    cit_raw = await _run([py, str(cit_script), url])
    full_raw = await _run([py, str(fetch_script), url, "full"])
    cit = json.loads(cit_raw)
    full = json.loads(full_raw)

    if "error" in cit:
        raise RuntimeError(str(cit["error"]))

    citability = float(cit.get("average_citability_score", 0.0))

    page = full.get("page") or {}
    structured = page.get("structured_data") or []
    schema_types = _types_from_structured_data(structured)
    schema_score = _schema_strength(schema_types)

    robots_data = full.get("robots") or {}
    ai_status = robots_data.get("ai_crawler_status") or {}
    bots_bool: dict[str, bool] = {}
    for name in WATCH_BOTS:
        st = ai_status.get(name, "NOT_MENTIONED")
        if st == "NO_ROBOTS_TXT":
            bots_bool[name] = True
        else:
            bots_bool[name] = status_implies_crawl_allowed(st)

    llms = full.get("llms") or {}
    llms_txt = llms.get("llms_txt") or {}
    has_llms = bool(llms_txt.get("exists"))

    overall = _overall_from_parts(citability, bots_bool, has_llms, schema_score)

    issues: list[str] = []
    tips: list[str] = []
    if citability < 45:
        issues.append(
            "Main content blocks score low for AI citability (structure & facts)."
        )
    for name, ok in bots_bool.items():
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

    if not has_llms:
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
    if not all(bots_bool.values()) and len(tips) < 3:
        tips.append(
            "Adjust robots.txt so major AI crawlers can access content you want cited."
        )
    if citability < 55 and len(tips) < 3:
        tips.append(
            "Rewrite key sections as self-contained answer blocks with stats and definitions."
        )

    return QuickAuditResult(
        overall_geo_score=min(100.0, max(0.0, overall)),
        citability_score=min(100.0, max(0.0, citability)),
        ai_crawler_access=bots_bool,
        has_llms_txt=has_llms,
        schema_org={"types": schema_types},
        top_issues=issues[:5],
        top_recommendations=tips[:3],
    )
