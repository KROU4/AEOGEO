"""Keyword model — SEO-style keywords linked to a project."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Keyword(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "keywords"
    __table_args__ = (Index("ix_keywords_project_category", "project_id", "category"),)

    keyword: Mapped[str] = mapped_column(String(512))
    category: Mapped[str] = mapped_column(String(128), default="general")
    search_volume: Mapped[int | None] = mapped_column(Integer, default=None)
    relevance_score: Mapped[float | None] = mapped_column(Numeric(5, 2), default=None)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=True)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="keywords")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Keyword {self.keyword!r}>"
