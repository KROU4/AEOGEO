"""Extract JSON-LD @type values from HTML."""

from __future__ import annotations

import json
from typing import Any

from bs4 import BeautifulSoup


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


def extract_schema_org_types(html: str) -> list[str]:
    """Return sorted unique schema.org types from application/ld+json scripts."""
    soup = BeautifulSoup(html, "lxml")
    types: set[str] = set()
    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
        except (json.JSONDecodeError, TypeError):
            continue
        types |= _collect_types(data)
    return sorted(types)
