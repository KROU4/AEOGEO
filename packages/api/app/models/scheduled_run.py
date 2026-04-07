"""ScheduledRun model — cron-based scheduled engine runs."""

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class ScheduledRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "scheduled_runs"

    cron_expression: Mapped[str] = mapped_column(String(128))
    engine_ids: Mapped[dict] = mapped_column(JSON)
    sample_count: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(default=True)

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    query_set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("query_sets.id"))

    # -- relationships --
    project: Mapped["Project"] = relationship()  # noqa: F821
    query_set: Mapped["QuerySet"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return f"<ScheduledRun cron={self.cron_expression!r} active={self.is_active}>"
