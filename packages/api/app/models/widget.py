"""Widget model for embeddable client-facing widgets."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Widget(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "widgets"

    name: Mapped[str] = mapped_column(String(255))
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))

    theme: Mapped[str] = mapped_column(String(32), default="dark")
    position: Mapped[str] = mapped_column(String(32), default="bottom-right")
    mode: Mapped[str] = mapped_column(
        String(32)
    )  # faq | blog_feed | ai_consultant
    max_items: Mapped[int] = mapped_column(default=5)
    border_radius: Mapped[int] = mapped_column(default=8)
    font_family: Mapped[str] = mapped_column(String(128), default="Inter")
    embed_token: Mapped[str] = mapped_column(String(255), unique=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    json_ld_enabled: Mapped[bool] = mapped_column(default=False)

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="widgets")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Widget {self.name!r} [{self.mode}]>"
