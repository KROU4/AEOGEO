"""Site GEO audit records per project."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from .project import Project


class SiteAudit(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "site_audits"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    overall_geo_score: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0
    )
    # status: pending | running | completed | failed
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    # Wall-clock start for this audit run (set when the record is created / workflow triggered).
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    temporal_workflow_id: Mapped[str | None] = mapped_column(
        String(256), nullable=True
    )
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # -- relationships --
    project: Mapped[Project] = relationship(foreign_keys=[project_id])  # noqa: F821
