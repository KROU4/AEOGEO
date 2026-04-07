"""Knowledge models — KnowledgeEntry and CustomFile for brand knowledge base."""

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class KnowledgeEntry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_entries"

    type: Mapped[str] = mapped_column(String(64))
    content: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    embedding = mapped_column(Vector(3072), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)

    brand_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("brands.id", ondelete="CASCADE")
    )

    # -- relationships --
    brand: Mapped["Brand"] = relationship(back_populates="knowledge_entries")  # noqa: F821

    def __repr__(self) -> str:
        return f"<KnowledgeEntry {self.type!r} v{self.version}>"


class CustomFile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "custom_files"

    filename: Mapped[str] = mapped_column(String(512))
    file_type: Mapped[str] = mapped_column(String(32))
    content_text: Mapped[str | None] = mapped_column(Text, default=None)
    file_size: Mapped[int | None] = mapped_column(Integer, default=None)

    brand_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("brands.id", ondelete="CASCADE")
    )

    # -- relationships --
    brand: Mapped["Brand"] = relationship(back_populates="custom_files")  # noqa: F821

    def __repr__(self) -> str:
        return f"<CustomFile {self.filename!r}>"
