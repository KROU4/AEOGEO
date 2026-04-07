"""Brand model — represents a client brand within a project."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Brand(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "brands"

    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    positioning: Mapped[str | None] = mapped_column(Text, default=None)
    website: Mapped[str | None] = mapped_column(String(512), default=None)
    allowed_phrases: Mapped[dict | None] = mapped_column(JSON, default=None)
    forbidden_phrases: Mapped[dict | None] = mapped_column(JSON, default=None)
    voice_guidelines: Mapped[str | None] = mapped_column(Text, default=None)
    industry: Mapped[str | None] = mapped_column(String(256), default=None)
    target_audience: Mapped[str | None] = mapped_column(Text, default=None)

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="brand")  # noqa: F821
    products: Mapped[list["Product"]] = relationship(back_populates="brand")  # noqa: F821
    competitors: Mapped[list["Competitor"]] = relationship(back_populates="brand")  # noqa: F821
    knowledge_entries: Mapped[list["KnowledgeEntry"]] = relationship(back_populates="brand")  # noqa: F821
    custom_files: Mapped[list["CustomFile"]] = relationship(back_populates="brand")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Brand {self.name!r}>"
