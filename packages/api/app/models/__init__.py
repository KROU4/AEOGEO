# ruff: noqa: I001
"""AEOGEO SQLAlchemy models — re-export all models for convenient imports.

Import order matters: models referenced by forward-ref relationships
(e.g. Brand -> Product) must have their targets imported BEFORE the
model that declares the relationship, so that SQLAlchemy's class
registry can resolve the string reference at configure_mappers() time.
"""

# Base must come first
from .base import Base, TimestampMixin, UUIDMixin  # noqa: F401

# Leaf models (no forward-ref relationships to other new models)
from .tenant import Tenant  # noqa: F401
from .user import User  # noqa: F401
from .public_audit import PublicAudit  # noqa: F401
from .role import Permission, Role, RolePermission, UserRole  # noqa: F401
from .ai_provider_key import AIProviderKey  # noqa: F401
from .ai_usage_event import AIUsageEvent  # noqa: F401
from .tenant_quota import TenantQuota  # noqa: F401
from .engine import Engine, ProjectEngine  # noqa: F401
from .report import Report  # noqa: F401
from .mention import Mention  # noqa: F401
from .citation import Citation  # noqa: F401
from .visibility_score import VisibilityScore  # noqa: F401
from .keyword import Keyword  # noqa: F401
from .recommendation import Recommendation  # noqa: F401

# Models that are forward-ref targets (must be imported before Brand)
from .product import Product  # noqa: F401
from .competitor import Competitor  # noqa: F401

# Brand references Product, Competitor
from .brand import Brand  # noqa: F401

# Project references Brand, Report, etc.
from .project import Project, ProjectMember  # noqa: F401

# Query models
from .query import Query, QueryCluster, QuerySet  # noqa: F401
from .scheduled_run import ScheduledRun  # noqa: F401

# Run/Answer chain
from .engine_run import EngineRun  # noqa: F401
from .answer import Answer  # noqa: F401

# Site GEO audits (FK → projects)
from .site_audit import SiteAudit  # noqa: F401

__all__ = [
    "AIProviderKey",
    "AIUsageEvent",
    "Answer",
    "Base",
    "Brand",
    "Citation",
    "Competitor",
    "Engine",
    "EngineRun",
    "Keyword",
    "Mention",
    "Permission",
    "Product",
    "Project",
    "ProjectEngine",
    "ProjectMember",
    "PublicAudit",
    "Query",
    "QueryCluster",
    "QuerySet",
    "Recommendation",
    "Report",
    "Role",
    "RolePermission",
    "ScheduledRun",
    "SiteAudit",
    "Tenant",
    "TenantQuota",
    "TimestampMixin",
    "User",
    "UserRole",
    "UUIDMixin",
    "VisibilityScore",
]
