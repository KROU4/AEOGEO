"""Full JSON-LD schema audit — pure code, no AI calls."""

from __future__ import annotations

import json
from typing import Any

from bs4 import BeautifulSoup

from geo_audit.models import AuditIssue, SchemaAuditResult


def _collect_types(obj: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(obj, dict):
        raw = obj.get("@type")
        if isinstance(raw, str):
            found.add(raw)
        elif isinstance(raw, list):
            found.update(str(x) for x in raw)
        for v in obj.values():
            found |= _collect_types(v)
    elif isinstance(obj, list):
        for item in obj:
            found |= _collect_types(item)
    return found


def _get_same_as_count(schema_objects: list[dict[str, Any]]) -> int:
    """Count sameAs entries on Organization/LocalBusiness objects."""
    count = 0
    for obj in schema_objects:
        raw_type = obj.get("@type", "")
        types = [raw_type] if isinstance(raw_type, str) else list(raw_type)
        if any(t in ("Organization", "LocalBusiness") for t in types):
            same_as = obj.get("sameAs", [])
            if isinstance(same_as, list):
                count += len(same_as)
            elif isinstance(same_as, str) and same_as:
                count += 1
    return count


def _has_search_action(schema_objects: list[dict[str, Any]]) -> bool:
    """Check if WebSite has a SearchAction potentialAction."""
    for obj in schema_objects:
        raw_type = obj.get("@type", "")
        types = [raw_type] if isinstance(raw_type, str) else list(raw_type)
        if "WebSite" in types:
            potential = obj.get("potentialAction", {})
            if isinstance(potential, dict):
                if potential.get("@type") == "SearchAction":
                    return True
            elif isinstance(potential, list):
                for action in potential:
                    if isinstance(action, dict) and action.get("@type") == "SearchAction":
                        return True
    return False


def _has_article_with_metadata(schema_objects: list[dict[str, Any]]) -> bool:
    article_types = ("Article", "BlogPosting", "NewsArticle", "TechArticle")
    for obj in schema_objects:
        raw_type = obj.get("@type", "")
        types = [raw_type] if isinstance(raw_type, str) else list(raw_type)
        if any(t in article_types for t in types):
            has_author = bool(obj.get("author"))
            has_date = bool(obj.get("datePublished"))
            if has_author and has_date:
                return True
    return False


def _is_schema_server_rendered(html: str) -> bool:
    """Check if JSON-LD scripts appear before </head> in the raw HTML."""
    head_end = html.lower().find("</head>")
    if head_end == -1:
        return False
    head_section = html[:head_end]
    return "application/ld+json" in head_section.lower()


def run_schema_audit(html: str) -> SchemaAuditResult:
    """Analyze JSON-LD structured data in HTML."""
    soup = BeautifulSoup(html, "lxml")
    issues: list[AuditIssue] = []

    schema_objects: list[dict[str, Any]] = []
    all_types: set[str] = set()

    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
        except (json.JSONDecodeError, TypeError):
            issues.append(
                AuditIssue(
                    severity="warning",
                    category="schema",
                    message="Found invalid JSON in a application/ld+json script block.",
                    recommendation="Fix the JSON syntax in your structured data markup.",
                )
            )
            continue
        if isinstance(data, list):
            schema_objects.extend(data)
            for item in data:
                all_types |= _collect_types(item)
        elif isinstance(data, dict):
            schema_objects.append(data)
            all_types |= _collect_types(data)

    schema_types = sorted(all_types)
    has_organization = bool(
        all_types & {"Organization", "LocalBusiness", "Corporation", "NGO", "EducationalOrganization"}
    )
    has_website = "WebSite" in all_types
    has_search_action = _has_search_action(schema_objects)
    has_breadcrumbs = "BreadcrumbList" in all_types
    has_speakable = "SpeakableSpecification" in all_types or any(
        obj.get("speakable") for obj in schema_objects
    )
    same_as_count = _get_same_as_count(schema_objects)
    is_server_rendered = _is_schema_server_rendered(html)
    has_article_with_meta = _has_article_with_metadata(schema_objects)

    # --- Scoring ---
    score = 0.0

    if has_organization:
        score += 20.0
        if same_as_count >= 3:
            score += 10.0
        elif same_as_count >= 1:
            score += 5.0
    else:
        issues.append(
            AuditIssue(
                severity="critical",
                category="schema",
                message="No Organization or LocalBusiness schema found.",
                recommendation="Add Organization JSON-LD with name, url, logo, and sameAs links.",
            )
        )

    if has_article_with_meta:
        score += 15.0
    elif any(t in all_types for t in ("Article", "BlogPosting", "NewsArticle")):
        issues.append(
            AuditIssue(
                severity="warning",
                category="schema",
                message="Article/BlogPosting schema is missing author or datePublished.",
                recommendation="Add author (Person) and datePublished to Article schema.",
            )
        )

    if has_website and has_search_action:
        score += 15.0
    elif has_website:
        score += 5.0
        issues.append(
            AuditIssue(
                severity="info",
                category="schema",
                message="WebSite schema lacks a SearchAction potentialAction.",
                recommendation="Add SearchAction to WebSite schema for sitelinks search box.",
            )
        )
    else:
        issues.append(
            AuditIssue(
                severity="warning",
                category="schema",
                message="No WebSite schema found.",
                recommendation="Add WebSite JSON-LD with url and potentialAction SearchAction.",
            )
        )

    if has_breadcrumbs:
        score += 10.0
    else:
        issues.append(
            AuditIssue(
                severity="info",
                category="schema",
                message="No BreadcrumbList schema found.",
                recommendation="Add BreadcrumbList to inner pages for navigation context.",
            )
        )

    if schema_objects:
        score += 10.0
    else:
        issues.append(
            AuditIssue(
                severity="critical",
                category="schema",
                message="No JSON-LD structured data found on the page.",
                recommendation="Add JSON-LD structured data starting with Organization and WebSite.",
            )
        )

    if is_server_rendered:
        score += 10.0
    elif schema_objects:
        issues.append(
            AuditIssue(
                severity="warning",
                category="schema",
                message="JSON-LD schema does not appear to be server-rendered (not in <head>).",
                recommendation="Ensure structured data is in the server-rendered HTML <head>.",
            )
        )

    if has_speakable:
        score += 5.0
    else:
        issues.append(
            AuditIssue(
                severity="info",
                category="schema",
                message="No Speakable schema found.",
                recommendation="Add SpeakableSpecification to highlight key content for voice assistants.",
            )
        )

    if same_as_count == 0 and has_organization:
        issues.append(
            AuditIssue(
                severity="warning",
                category="schema",
                message="Organization schema has no sameAs links.",
                recommendation="Add sameAs with LinkedIn, Wikipedia, Wikidata, and social profiles.",
            )
        )

    has_deprecated = any(
        isinstance(obj, dict)
        and obj.get("@type") == "ItemList"
        and not obj.get("itemListElement")
        for obj in schema_objects
    )
    if not has_deprecated:
        score += 5.0
    else:
        issues.append(
            AuditIssue(
                severity="warning",
                category="schema",
                message="ItemList schema found without itemListElement entries.",
                recommendation="Remove empty ItemList or populate with actual list items.",
            )
        )

    return SchemaAuditResult(
        score=round(min(score, 100.0), 1),
        schema_types=schema_types,
        has_organization=has_organization,
        has_website=has_website,
        has_search_action=has_search_action,
        has_breadcrumbs=has_breadcrumbs,
        has_speakable=has_speakable,
        same_as_count=same_as_count,
        is_server_rendered=is_server_rendered,
        schema_objects=schema_objects,
        issues=issues,
    )
