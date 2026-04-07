"""WidgetEvent model — public widget engagement analytics."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class WidgetEvent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "widget_events"

    widget_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("widgets.id", ondelete="CASCADE")
    )
    content_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("content.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    event_type: Mapped[str] = mapped_column(String(32))
    session_id: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)

    widget: Mapped["Widget"] = relationship()  # noqa: F821
    content: Mapped["Content | None"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return f"<WidgetEvent {self.event_type} widget={self.widget_id}>"
