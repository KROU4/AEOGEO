"""Competitor model — represents a competitor tracked against a brand."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Competitor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "competitors"

    name: Mapped[str] = mapped_column(String(256))
    website: Mapped[str | None] = mapped_column(String(512), default=None)
    positioning: Mapped[str | None] = mapped_column(Text, default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    brand_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("brands.id", ondelete="CASCADE")
    )

    # -- relationships --
    brand: Mapped["Brand"] = relationship(back_populates="competitors")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Competitor {self.name!r}>"
