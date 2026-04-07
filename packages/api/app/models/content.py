"""Content model for all content types."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Content(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "content"

    title: Mapped[str] = mapped_column(String(512))
    body: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(
        String(64)
    )  # faq | blog | comparison | buyer_guide | pricing_clarifier | glossary
    status: Mapped[str] = mapped_column(
        String(32), default="draft"
    )  # draft | review | published | archived

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    reviewer_notes: Mapped[str | None] = mapped_column(Text, default=None)
    published_at: Mapped[datetime | None] = mapped_column(default=None)
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("content_templates.id"), default=None
    )
    json_ld: Mapped[str | None] = mapped_column(Text, default=None)

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="content")  # noqa: F821
    author: Mapped["User"] = relationship(back_populates="authored_content")  # noqa: F821
    template: Mapped["ContentTemplate | None"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return f"<Content {self.title!r} [{self.content_type}]>"
