"""RBAC models: Role, Permission, RolePermission, UserRole."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Role(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    is_system: Mapped[bool] = mapped_column(default=False)

    # -- relationships --
    tenant: Mapped["Tenant"] = relationship(back_populates="roles")  # noqa: F821
    role_permissions: Mapped[list["RolePermission"]] = relationship(back_populates="role")
    user_roles: Mapped[list["UserRole"]] = relationship(back_populates="role")

    def __repr__(self) -> str:
        return f"<Role {self.name!r}>"


class Permission(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "permissions"

    resource: Mapped[str] = mapped_column(String(128))  # e.g. "content"
    action: Mapped[str] = mapped_column(String(128))  # e.g. "create"
    description: Mapped[str | None] = mapped_column(Text, default=None)

    # -- relationships --
    role_permissions: Mapped[list["RolePermission"]] = relationship(back_populates="permission")

    def __repr__(self) -> str:
        return f"<Permission {self.resource}:{self.action}>"


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id"), primary_key=True
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permissions.id"), primary_key=True
    )

    # -- relationships --
    role: Mapped["Role"] = relationship(back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(back_populates="role_permissions")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id"), primary_key=True
    )

    # -- relationships --
    user: Mapped["User"] = relationship()  # noqa: F821
    role: Mapped["Role"] = relationship(back_populates="user_roles")
