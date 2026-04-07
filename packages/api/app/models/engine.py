"""Engine and ProjectEngine models for AI engine registry."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Engine(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "engines"

    name: Mapped[str] = mapped_column(String(128))  # e.g. "ChatGPT"
    slug: Mapped[str] = mapped_column(String(128), unique=True)
    provider: Mapped[str] = mapped_column(String(128))  # e.g. "openai"
    is_active: Mapped[bool] = mapped_column(default=True)
    icon_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    model_name: Mapped[str | None] = mapped_column(String(128), default=None)
    adapter_config: Mapped[dict | None] = mapped_column(JSON, default=None)

    # -- relationships --
    project_engines: Mapped[list["ProjectEngine"]] = relationship(back_populates="engine")

    def __repr__(self) -> str:
        return f"<Engine {self.name!r} ({self.provider})>"


class ProjectEngine(Base):
    __tablename__ = "project_engines"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id"), primary_key=True
    )
    engine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engines.id"), primary_key=True
    )
    is_active: Mapped[bool] = mapped_column(default=True)

    # -- relationships --
    project: Mapped["Project"] = relationship(back_populates="project_engines")  # noqa: F821
    engine: Mapped["Engine"] = relationship(back_populates="project_engines")
