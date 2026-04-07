"""User model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True)
    clerk_user_id: Mapped[str | None] = mapped_column(String(255), unique=True, default=None)
    hashed_password: Mapped[str] = mapped_column(String(1024))
    name: Mapped[str] = mapped_column(String(255))
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    is_active: Mapped[bool] = mapped_column(default=True)

    # Invite flow
    invite_token: Mapped[str | None] = mapped_column(String(512), default=None)
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    # Password reset flow
    reset_token: Mapped[str | None] = mapped_column(String(512), default=None)
    reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    # -- relationships --
    tenant: Mapped["Tenant"] = relationship(back_populates="users")  # noqa: F821
    authored_content: Mapped[list["Content"]] = relationship(back_populates="author")  # noqa: F821
    project_memberships: Mapped[list["ProjectMember"]] = relationship(back_populates="user")  # noqa: F821

    def __repr__(self) -> str:
        return f"<User {self.email!r}>"
