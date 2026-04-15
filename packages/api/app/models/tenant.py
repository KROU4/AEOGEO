"""Tenant (organization) model."""

import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Tenant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    plan: Mapped[str] = mapped_column(String(32), default="free", server_default="free")

    # -- relationships --
    users: Mapped[list["User"]] = relationship(back_populates="tenant")  # noqa: F821
    roles: Mapped[list["Role"]] = relationship(back_populates="tenant")  # noqa: F821
    projects: Mapped[list["Project"]] = relationship(back_populates="tenant")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Tenant {self.slug!r}>"
