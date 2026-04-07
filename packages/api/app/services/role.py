"""Role service — real CRUD for roles, permissions, and user-role assignments."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import Permission, Role, RolePermission, UserRole

logger = logging.getLogger(__name__)


class RoleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Role CRUD
    # ------------------------------------------------------------------

    async def list_roles(self, tenant_id: UUID) -> list[Role]:
        """List all roles for a tenant, eagerly loading permissions."""
        result = await self.db.execute(
            select(Role)
            .where(Role.tenant_id == tenant_id)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .order_by(Role.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_role(self, role_id: UUID, tenant_id: UUID) -> Role | None:
        """Get a single role with its permissions."""
        result = await self.db.execute(
            select(Role)
            .where(Role.id == role_id, Role.tenant_id == tenant_id)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
        )
        return result.scalar_one_or_none()

    async def create_role(
        self,
        tenant_id: UUID,
        name: str,
        description: str = "",
    ) -> Role:
        """Create a new custom role."""
        role = Role(
            name=name,
            description=description,
            tenant_id=tenant_id,
            is_system=False,
        )
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)

        # Re-fetch with permissions loaded
        return await self.get_role(role.id, tenant_id)  # type: ignore[return-value]

    async def update_role(
        self,
        role_id: UUID,
        tenant_id: UUID,
        name: str | None = None,
        description: str | None = None,
    ) -> Role | None:
        """Update a role's name and/or description. Cannot update system roles."""
        role = await self.get_role(role_id, tenant_id)
        if role is None:
            return None
        if role.is_system:
            raise ValueError("Cannot modify a system role")

        if name is not None:
            role.name = name
        if description is not None:
            role.description = description

        await self.db.commit()
        await self.db.refresh(role)
        return await self.get_role(role_id, tenant_id)

    async def delete_role(self, role_id: UUID, tenant_id: UUID) -> bool:
        """Delete a role. Cannot delete system roles."""
        role = await self.get_role(role_id, tenant_id)
        if role is None:
            return False
        if role.is_system:
            raise ValueError("Cannot delete a system role")

        await self.db.delete(role)
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Permissions
    # ------------------------------------------------------------------

    async def list_all_permissions(self) -> list[Permission]:
        """List all available permissions."""
        result = await self.db.execute(
            select(Permission).order_by(Permission.resource, Permission.action)
        )
        return list(result.scalars().all())

    async def get_role_permissions(self, role_id: UUID, tenant_id: UUID) -> list[Permission]:
        """Get permissions assigned to a role."""
        role = await self.get_role(role_id, tenant_id)
        if role is None:
            return []
        return [rp.permission for rp in role.role_permissions]

    async def set_role_permissions(
        self,
        role_id: UUID,
        tenant_id: UUID,
        permission_ids: list[UUID],
    ) -> list[Permission]:
        """Replace all permissions for a role. Cannot modify system roles."""
        role = await self.get_role(role_id, tenant_id)
        if role is None:
            raise ValueError("Role not found")
        if role.is_system:
            raise ValueError("Cannot modify permissions of a system role")

        # Remove existing permissions
        await self.db.execute(
            delete(RolePermission).where(RolePermission.role_id == role_id)
        )

        # Add new permissions (verify each exists)
        if permission_ids:
            perm_result = await self.db.execute(
                select(Permission).where(Permission.id.in_(permission_ids))
            )
            valid_perms = list(perm_result.scalars().all())
            valid_ids = {p.id for p in valid_perms}

            for pid in permission_ids:
                if pid in valid_ids:
                    self.db.add(RolePermission(role_id=role_id, permission_id=pid))

        await self.db.commit()

        return await self.get_role_permissions(role_id, tenant_id)

    # ------------------------------------------------------------------
    # User-Role assignments
    # ------------------------------------------------------------------

    async def assign_role_to_user(
        self,
        user_id: UUID,
        role_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        """Assign a role to a user. Returns True if created, False if already exists."""
        # Verify role belongs to tenant
        role = await self.get_role(role_id, tenant_id)
        if role is None:
            raise ValueError("Role not found")

        # Check if assignment already exists
        result = await self.db.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return False

        self.db.add(UserRole(user_id=user_id, role_id=role_id))
        await self.db.commit()

        logger.info("Assigned role %s to user %s", role_id, user_id)
        return True

    async def remove_role_from_user(
        self,
        user_id: UUID,
        role_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        """Remove a role from a user. Returns True if removed, False if not found."""
        # Verify role belongs to tenant
        role = await self.get_role(role_id, tenant_id)
        if role is None:
            raise ValueError("Role not found")

        result = await self.db.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
            )
        )
        assignment = result.scalar_one_or_none()
        if assignment is None:
            return False

        await self.db.delete(assignment)
        await self.db.commit()

        logger.info("Removed role %s from user %s", role_id, user_id)
        return True
