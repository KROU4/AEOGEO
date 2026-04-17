"""Real brand authority checker via HTTP lookups.

Replaces the old text-search heuristic in full_audit.py with actual
HTTP requests to external platforms to verify brand presence.
"""

from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; GEOAuditBot/1.0; +https://aeogeo.com/bot)",
    "Accept": "text/html,application/json,*/*;q=0.9",
}
_TIMEOUT = 6.0


def _slug(name: str) -> str:
    """Convert brand name to URL-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def _check_wikipedia(client: httpx.AsyncClient, brand_name: str) -> float:
    """Wikipedia REST API — +25 if page found."""
    try:
        encoded = urllib.parse.quote(brand_name)
        r = await client.get(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}",
            timeout=_TIMEOUT,
        )
        if r.status_code == 200:
            logger.debug("brand_authority: Wikipedia found for %s", brand_name)
            return 25.0
    except Exception as exc:
        logger.debug("brand_authority: Wikipedia error: %s", exc)
    return 0.0


async def _check_wikidata(client: httpx.AsyncClient, brand_name: str) -> float:
    """Wikidata entity search — +20 if entity found."""
    try:
        params = {
            "action": "wbsearchentities",
            "search": brand_name,
            "language": "en",
            "format": "json",
            "limit": "3",
        }
        r = await client.get(
            "https://www.wikidata.org/w/api.php",
            params=params,
            timeout=_TIMEOUT,
        )
        if r.status_code == 200:
            data = r.json()
            if data.get("search"):
                logger.debug("brand_authority: Wikidata found for %s", brand_name)
                return 20.0
    except Exception as exc:
        logger.debug("brand_authority: Wikidata error: %s", exc)
    return 0.0


async def _check_linkedin(client: httpx.AsyncClient, brand_name: str) -> float:
    """LinkedIn company page — +15 if 200 response."""
    try:
        slug = _slug(brand_name)
        r = await client.head(
            f"https://www.linkedin.com/company/{slug}",
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
        if r.status_code == 200:
            logger.debug("brand_authority: LinkedIn found for %s", brand_name)
            return 15.0
    except Exception as exc:
        logger.debug("brand_authority: LinkedIn error: %s", exc)
    return 0.0


async def _check_trustpilot(client: httpx.AsyncClient, domain: str) -> float:
    """Trustpilot review page — +10 if 200 response."""
    try:
        r = await client.head(
            f"https://www.trustpilot.com/review/{domain}",
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
        if r.status_code == 200:
            logger.debug("brand_authority: Trustpilot found for %s", domain)
            return 10.0
    except Exception as exc:
        logger.debug("brand_authority: Trustpilot error: %s", exc)
    return 0.0


async def _check_product_hunt(client: httpx.AsyncClient, brand_name: str) -> float:
    """Product Hunt search — +10 if results found."""
    try:
        encoded = urllib.parse.quote(brand_name)
        r = await client.get(
            f"https://www.producthunt.com/search?q={encoded}",
            timeout=_TIMEOUT,
            follow_redirects=True,
        )
        if r.status_code == 200 and brand_name.lower() in r.text.lower():
            logger.debug("brand_authority: Product Hunt found for %s", brand_name)
            return 10.0
    except Exception as exc:
        logger.debug("brand_authority: Product Hunt error: %s", exc)
    return 0.0


async def run_brand_authority_audit(brand_name: str, domain: str) -> float:
    """Run all platform checks in parallel and return total score (0-100).

    Gracefully returns 0 for any individual check that fails.
    Total is capped at 100.
    """
    if not brand_name:
        return 0.0

    async with httpx.AsyncClient(headers=_HEADERS, follow_redirects=False) as client:
        results = await asyncio.gather(
            _check_wikipedia(client, brand_name),
            _check_wikidata(client, brand_name),
            _check_linkedin(client, brand_name),
            _check_trustpilot(client, domain),
            _check_product_hunt(client, brand_name),
            return_exceptions=True,
        )

    total = 0.0
    for r in results:
        if isinstance(r, (int, float)):
            total += r
        # exceptions silently count as 0

    return min(100.0, total)
