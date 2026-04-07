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
from .role import Permission, Role, RolePermission, UserRole  # noqa: F401
from .ai_provider_key import AIProviderKey  # noqa: F401
from .ai_usage_event import AIUsageEvent  # noqa: F401
from .tenant_quota import TenantQuota  # noqa: F401
from .content_template import ContentTemplate  # noqa: F401
from .engine import Engine, ProjectEngine  # noqa: F401
from .report import Report  # noqa: F401
from .widget import Widget  # noqa: F401
from .widget_event import WidgetEvent  # noqa: F401
from .analytics_integration import AnalyticsIntegration  # noqa: F401
from .traffic_snapshot import TrafficSnapshot  # noqa: F401
from .mention import Mention  # noqa: F401
from .citation import Citation  # noqa: F401
from .visibility_score import VisibilityScore  # noqa: F401
from .feedback import FeedbackEntry  # noqa: F401
from .keyword import Keyword  # noqa: F401
from .recommendation import Recommendation  # noqa: F401

# Models that are forward-ref targets (must be imported before Brand)
from .product import Product  # noqa: F401
from .competitor import Competitor  # noqa: F401
from .knowledge import CustomFile, KnowledgeEntry  # noqa: F401

# Brand references Product, Competitor, KnowledgeEntry, CustomFile
from .brand import Brand  # noqa: F401

# Project references Brand, Content, Report, Widget, etc.
from .project import Project, ProjectMember  # noqa: F401

# Content references ContentTemplate
from .content import Content  # noqa: F401

# Query models
from .query import Query, QueryCluster, QuerySet  # noqa: F401
from .scheduled_run import ScheduledRun  # noqa: F401

# Run/Answer chain
from .engine_run import EngineRun  # noqa: F401
from .answer import Answer  # noqa: F401

__all__ = [
    "AIProviderKey",
    "AIUsageEvent",
    "AnalyticsIntegration",
    "Answer",
    "Base",
    "Brand",
    "Citation",
    "Competitor",
    "Content",
    "ContentTemplate",
    "CustomFile",
    "Engine",
    "EngineRun",
    "FeedbackEntry",
    "Keyword",
    "KnowledgeEntry",
    "Mention",
    "Permission",
    "Product",
    "Project",
    "ProjectEngine",
    "ProjectMember",
    "Query",
    "QueryCluster",
    "QuerySet",
    "Recommendation",
    "Report",
    "Role",
    "RolePermission",
    "ScheduledRun",
    "Tenant",
    "TenantQuota",
    "TimestampMixin",
    "TrafficSnapshot",
    "User",
    "UserRole",
    "UUIDMixin",
    "VisibilityScore",
    "Widget",
    "WidgetEvent",
]
