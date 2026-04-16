"""ContentPushEvent model for before/after attribution snapshots."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class ContentPushEvent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "content_push_events"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    triggered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    content_title: Mapped[str | None] = mapped_column(String(512), default=None)
    content_url: Mapped[str | None] = mapped_column(Text, default=None)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    recheck_at: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    status: Mapped[str] = mapped_column(String(32), default="pending")

    baseline_total_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00")
    )
    baseline_mentions: Mapped[int] = mapped_column(Integer, default=0)
    baseline_citations: Mapped[int] = mapped_column(Integer, default=0)

    checked_total_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), default=None)
    checked_mentions: Mapped[int | None] = mapped_column(Integer, default=None)
    checked_citations: Mapped[int | None] = mapped_column(Integer, default=None)

    delta_total_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), default=None)
    delta_mentions: Mapped[int | None] = mapped_column(Integer, default=None)
    delta_citations: Mapped[int | None] = mapped_column(Integer, default=None)

    temporal_workflow_id: Mapped[str | None] = mapped_column(String(256), default=None)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)

    project: Mapped["Project"] = relationship(back_populates="content_push_events")  # noqa: F821
    triggered_by_user: Mapped["User | None"] = relationship()  # noqa: F821
