"""Traffic snapshot model — daily traffic metrics pulled from analytics providers."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class TrafficSnapshot(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "traffic_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "provider",
            "date",
            name="uq_traffic_project_provider_date",
        ),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    provider: Mapped[str] = mapped_column(String(32))
    date: Mapped[date] = mapped_column(Date)
    pageviews: Mapped[int] = mapped_column(Integer, default=0)
    sessions: Mapped[int] = mapped_column(Integer, default=0)
    users: Mapped[int] = mapped_column(Integer, default=0)
    traffic_sources: Mapped[dict] = mapped_column(JSONB, default=dict)

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="traffic_snapshots")  # noqa: F821

    def __repr__(self) -> str:
        return f"<TrafficSnapshot {self.provider!r} date={self.date}>"
