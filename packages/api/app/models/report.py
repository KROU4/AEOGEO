"""Report model for analytics and audit reports."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Report(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "reports"

    title: Mapped[str] = mapped_column(String(512))
    report_type: Mapped[str] = mapped_column(
        String(64)
    )  # visibility_audit | competitive_analysis | content_performance

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    data_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)

    shareable_token: Mapped[str | None] = mapped_column(
        String(255), unique=True, default=None
    )
    expires_at: Mapped[datetime | None] = mapped_column(default=None)

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="reports")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Report {self.title!r} [{self.report_type}]>"
