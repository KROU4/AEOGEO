"""Geo audit service — prefers cloned geo-seo-claude scripts when configured."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from geo_audit.models import QuickAuditResult
from geo_audit.quick_native import run_quick_audit_native
from geo_audit.subprocess_runner import run_quick_audit_subprocess

logger = logging.getLogger(__name__)


class GeoAuditService:
    """Runs quick GEO audits via upstream geo-seo-claude scripts or built-in native analysis."""

    async def run_quick_audit(self, url: str) -> QuickAuditResult:
        home = os.environ.get("GEO_SEO_CLAUDE_HOME", "").strip()
        if home:
            root = Path(home)
            try:
                return await run_quick_audit_subprocess(root, url)
            except Exception as exc:
                logger.warning(
                    "GEO_SEO_CLAUDE_HOME audit failed, using native implementation: %s",
                    exc,
                )
        return await run_quick_audit_native(url)
