"""ContentTemplate model — reusable templates for content generation."""

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDMixin


class ContentTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "content_templates"

    name: Mapped[str] = mapped_column(String(256))
    content_type: Mapped[str] = mapped_column(String(64))
    template_prompt: Mapped[str] = mapped_column(Text)
    structure_schema: Mapped[dict | None] = mapped_column(JSON, default=None)

    def __repr__(self) -> str:
        return f"<ContentTemplate {self.name!r} [{self.content_type}]>"
