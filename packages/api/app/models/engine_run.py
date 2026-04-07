"""EngineRun model — represents a single execution run against an AI engine."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class EngineRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "engine_runs"

    status: Mapped[str] = mapped_column(String(32), default="pending")
    engine_status: Mapped[str] = mapped_column(String(32), default="pending")
    parse_status: Mapped[str] = mapped_column(String(32), default="pending")
    score_status: Mapped[str] = mapped_column(String(32), default="pending")
    sample_count: Mapped[int] = mapped_column(Integer, default=1)
    triggered_by: Mapped[str] = mapped_column(String(32), default="manual")
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    answers_expected: Mapped[int] = mapped_column(Integer, default=0)
    answers_completed: Mapped[int] = mapped_column(Integer, default=0)
    parse_completed: Mapped[int] = mapped_column(Integer, default=0)
    score_completed: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(default=None)
    completed_at: Mapped[datetime | None] = mapped_column(default=None)
    engine_started_at: Mapped[datetime | None] = mapped_column(default=None)
    engine_completed_at: Mapped[datetime | None] = mapped_column(default=None)
    parse_started_at: Mapped[datetime | None] = mapped_column(default=None)
    parse_completed_at: Mapped[datetime | None] = mapped_column(default=None)
    score_started_at: Mapped[datetime | None] = mapped_column(default=None)
    score_completed_at: Mapped[datetime | None] = mapped_column(default=None)

    query_set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("query_sets.id"))
    engine_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("engines.id"))
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))

    # -- relationships --
    query_set: Mapped["QuerySet"] = relationship()  # noqa: F821
    engine: Mapped["Engine"] = relationship()  # noqa: F821
    project: Mapped["Project"] = relationship()  # noqa: F821
    answers: Mapped[list["Answer"]] = relationship(back_populates="run")  # noqa: F821

    def __repr__(self) -> str:
        return f"<EngineRun {self.status!r} [{self.triggered_by}]>"
