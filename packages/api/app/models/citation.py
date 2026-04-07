"""Citation model — tracks source citations within AI answers."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Citation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "citations"

    source_url: Mapped[str] = mapped_column(String(1024))
    source_title: Mapped[str | None] = mapped_column(String(512), default=None)
    is_client_source: Mapped[bool] = mapped_column(default=False)

    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE")
    )

    # -- relationships --
    answer: Mapped["Answer"] = relationship(back_populates="citations")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Citation {self.source_url[:60]!r}>"
