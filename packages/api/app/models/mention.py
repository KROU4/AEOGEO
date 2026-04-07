"""Mention model — tracks entity mentions within AI answers."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Mention(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "mentions"

    entity_type: Mapped[str] = mapped_column(String(32))
    entity_name: Mapped[str] = mapped_column(String(256))
    sentiment: Mapped[str] = mapped_column(String(32))
    position_in_answer: Mapped[int | None] = mapped_column(Integer, default=None)
    is_recommended: Mapped[bool] = mapped_column(default=False)
    context_snippet: Mapped[str | None] = mapped_column(Text, default=None)

    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("answers.id", ondelete="CASCADE")
    )

    # -- relationships --
    answer: Mapped["Answer"] = relationship(back_populates="mentions")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Mention {self.entity_name!r} [{self.sentiment}]>"
