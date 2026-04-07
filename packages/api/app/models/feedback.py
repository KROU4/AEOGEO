"""FeedbackEntry model — user feedback on any entity."""

import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class FeedbackEntry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "feedback_entries"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "entity_type",
            "entity_id",
            name="uq_feedback_entries_user_entity",
        ),
    )

    entity_type: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    feedback: Mapped[str] = mapped_column(String(16))
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    # -- relationships --
    user: Mapped["User"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return f"<FeedbackEntry {self.entity_type}:{self.feedback}>"
