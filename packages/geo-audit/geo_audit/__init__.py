"""GEO quick audit — geo-seo-claude script wrapper + native implementation."""

from geo_audit.models import QuickAuditResult
from geo_audit.service import GeoAuditService

__all__ = ["GeoAuditService", "QuickAuditResult"]
