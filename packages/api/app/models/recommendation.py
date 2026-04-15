"""Recommendation model — AI-generated improvement suggestions for a project."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Recommendation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("ix_recommendations_project_created", "project_id", "created_at"),
    )

    category: Mapped[str] = mapped_column(
        String(64)
    )  # content, seo, brand_positioning, technical
    priority: Mapped[str] = mapped_column(String(16))  # high, medium, low
    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str] = mapped_column(Text)
    affected_keywords: Mapped[dict | None] = mapped_column(JSON, default=None)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    impact_estimate: Mapped[str | None] = mapped_column(Text, default=None)
    instructions: Mapped[str | None] = mapped_column(Text, default=None)
    source: Mapped[str | None] = mapped_column(String(256), default=None)
    sort_rank: Mapped[int | None] = mapped_column(Integer, default=None)
    scope: Mapped[str | None] = mapped_column(String(16), default=None)

    run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("engine_runs.id", ondelete="SET NULL"), default=None
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="recommendations")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Recommendation {self.title!r}>"
