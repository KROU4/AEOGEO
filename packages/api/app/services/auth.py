from __future__ import annotations

from collections import defaultdict
import logging
import re
import secrets
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.project import Project, ProjectMember
from app.models.role import Permission, Role, RolePermission, UserRole
from app.models.tenant import Tenant
from app.models.user import User
from app.services.clerk import ClerkIdentity, ClerkService
from app.utils.security import hash_password

logger = logging.getLogger(__name__)

PERMISSIONS = [
    ("dashboard", "view"),
    ("projects", "manage"),
    ("content", "create"),
    ("content", "approve"),
    ("reports", "view"),
    ("reports", "create"),
    ("widgets", "manage"),
    ("engines", "manage"),
    ("team", "invite"),
    ("settings", "manage"),
    ("ai_keys", "manage"),
    ("ai_usage", "view"),
    ("ai_usage", "manage"),
    ("admin", "access"),
]

DEFAULT_ROLES = {
    "Admin": True,
    "Editor": False,
    "Viewer": False,
}

DEFAULT_ROLE_PERMISSIONS = {
    "Admin": {f"{resource}:{action}" for resource, action in PERMISSIONS},
    "Editor": {
        "dashboard:view",
        "projects:manage",
        "content:create",
        "reports:view",
        "reports:create",
        "widgets:manage",
        "engines:manage",
        "ai_usage:view",
    },
    "Viewer": {
        "dashboard:view",
        "reports:view",
        "ai_usage:view",
    },
}


class AuthService:
    def __init__(self, db: AsyncSession, settings: Settings | None = None):
        self.db = db
        self.settings = settings or Settings()
        self.clerk = ClerkService(self.settings)

    async def get_user_by_id(self, user_id: UUID | str) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        normalized_email = self.normalize_email(email)
        result = await self.db.execute(select(User).where(User.email == normalized_email))
        return result.scalar_one_or_none()

    async def get_user_by_clerk_user_id(self, clerk_user_id: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.clerk_user_id == clerk_user_id)
        )
        return result.scalar_one_or_none()

    async def get_permissions_for_user(self, user_id: UUID) -> list[str]:
        result = await self.db.execute(
            select(Permission.resource, Permission.action)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .where(UserRole.user_id == user_id)
            .distinct()
            .order_by(Permission.resource, Permission.action)
        )
        return [f"{row.resource}:{row.action}" for row in result.all()]

    async def resolve_local_user(
        self,
        clerk_identity: ClerkIdentity,
        *,
        preferred_name: str | None = None,
    ) -> User | None:
        user = await self.get_user_by_clerk_user_id(clerk_identity.clerk_user_id)
        if user is not None:
            updated = False
            normalized_email = self.normalize_email(clerk_identity.email)
            if user.email != normalized_email:
                user.email = normalized_email
                updated = True
            if not user.name.strip():
                user.name = self.resolve_display_name(clerk_identity, preferred_name)
                updated = True
            if updated:
                await self.db.commit()
                await self.db.refresh(user)
            return user

        user = await self.get_user_by_email(clerk_identity.email)
        if user is None:
            return None

        if user.clerk_user_id and user.clerk_user_id != clerk_identity.clerk_user_id:
            raise ValueError("clerk_identity_conflict")

        user.clerk_user_id = clerk_identity.clerk_user_id
        if not user.name.strip():
            user.name = self.resolve_display_name(clerk_identity, preferred_name)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def bootstrap_clerk_user(
        self,
        clerk_identity: ClerkIdentity,
        *,
        company_name: str | None = None,
        preferred_name: str | None = None,
    ) -> User:
        existing_user = await self.resolve_local_user(
            clerk_identity,
            preferred_name=preferred_name,
        )
        if existing_user is not None:
            return existing_user

        normalized_company_name = (company_name or "").strip()
        if not normalized_company_name:
            raise ValueError("company_name_required")

        tenant = await self._create_tenant(normalized_company_name)
        roles = await self._ensure_default_roles(tenant.id)

        user = User(
            email=self.normalize_email(clerk_identity.email),
            clerk_user_id=clerk_identity.clerk_user_id,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            name=self.resolve_display_name(clerk_identity, preferred_name),
            tenant_id=tenant.id,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()

        self.db.add(UserRole(user_id=user.id, role_id=roles["Admin"].id))

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def create_invite(
        self,
        *,
        email: str,
        inviter: User,
        role_id: str | None = None,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        normalized_email = self.normalize_email(email)
        if normalized_email == self.normalize_email(inviter.email):
            raise ValueError("cannot_invite_self")

        roles = await self._ensure_default_roles(inviter.tenant_id)
        role = await self._resolve_invite_role(inviter.tenant_id, role_id, roles)
        project = await self._resolve_project(inviter.tenant_id, project_id)

        existing_user = await self.get_user_by_email(normalized_email)
        if existing_user is not None and existing_user.tenant_id != inviter.tenant_id:
            raise ValueError("email_taken")

        if existing_user is None:
            existing_user = User(
                email=normalized_email,
                clerk_user_id=None,
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                name=normalized_email.split("@", 1)[0],
                tenant_id=inviter.tenant_id,
                is_active=True,
            )
            self.db.add(existing_user)
            await self.db.flush()

        if role is not None:
            await self._ensure_user_role(existing_user.id, role.id)
        if project is not None:
            await self._ensure_project_membership(existing_user.id, project.id)

        if existing_user.clerk_user_id:
            await self.db.commit()
            return {
                "message": "Member access updated",
                "invitation_id": None,
                "email": normalized_email,
                "status": "active",
            }

        invitation = await self.clerk.create_invitation(
            email=normalized_email,
            redirect_url=self.settings.clerk_invitation_redirect_url_value,
            public_metadata={
                "tenant_id": str(inviter.tenant_id),
                "role_id": str(role.id) if role else None,
                "project_id": str(project.id) if project else None,
                "inviter_user_id": str(inviter.id),
            },
        )

        await self.db.commit()
        return {
            "message": "Invitation sent",
            "invitation_id": invitation.invitation_id,
            "email": normalized_email,
            "status": invitation.status,
        }

    async def list_team(self, current_user: User) -> list[dict[str, Any]]:
        result = await self.db.execute(
            select(User)
            .where(User.tenant_id == current_user.tenant_id)
            .options(
                selectinload(User.project_memberships).selectinload(ProjectMember.project)
            )
            .order_by(User.created_at.asc())
        )
        users = list(result.scalars().all())
        if not users:
            return []

        user_ids = [user.id for user in users]
        role_result = await self.db.execute(
            select(UserRole.user_id, Role.name)
            .join(Role, Role.id == UserRole.role_id)
            .where(UserRole.user_id.in_(user_ids))
            .order_by(Role.name.asc())
        )
        roles_by_user: dict[UUID, list[str]] = defaultdict(list)
        for user_id, role_name in role_result.all():
            roles_by_user[user_id].append(role_name)

        invitations_by_email: dict[str, Any] = {}
        try:
            invitations = await self.clerk.list_pending_invitations()
        except Exception as exc:
            logger.warning("Failed to load Clerk invitations for team listing: %s", exc)
            invitations = []

        for invitation in invitations:
            invitations_by_email[invitation.email] = invitation

        members: list[dict[str, Any]] = []
        for user in users:
            invitation = None if user.clerk_user_id else invitations_by_email.get(user.email)
            project_memberships = []
            for membership in user.project_memberships:
                project = membership.project
                if project is None:
                    continue
                project_memberships.append(
                    {
                        "project_id": str(project.id),
                        "project_name": project.name,
                        "role": membership.role,
                    }
                )

            members.append(
                {
                    "user_id": str(user.id),
                    "email": user.email,
                    "name": user.name,
                    "status": "active" if user.clerk_user_id else "pending",
                    "roles": roles_by_user.get(user.id, []),
                    "projects": project_memberships,
                    "is_current_user": user.id == current_user.id,
                    "invitation_id": invitation.invitation_id if invitation else None,
                    "invited_at": invitation.created_at if invitation else user.created_at,
                    "invitation_expires_at": invitation.expires_at if invitation else None,
                }
            )

        members.sort(
            key=lambda item: (
                item["status"] != "active",
                not item["is_current_user"],
                item["name"].lower(),
                item["email"],
            )
        )
        return members

    async def _create_tenant(self, company_name: str) -> Tenant:
        base_slug = self._slugify(company_name)
        slug = base_slug
        suffix = 1

        while await self._tenant_slug_exists(slug):
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        tenant = Tenant(name=company_name, slug=slug)
        self.db.add(tenant)
        await self.db.flush()
        return tenant

    async def _tenant_slug_exists(self, slug: str) -> bool:
        result = await self.db.execute(select(Tenant.id).where(Tenant.slug == slug))
        return result.scalar_one_or_none() is not None

    async def _ensure_default_roles(self, tenant_id: UUID) -> dict[str, Role]:
        permissions = await self._ensure_permissions()
        result = await self.db.execute(
            select(Role)
            .where(Role.tenant_id == tenant_id)
            .options(selectinload(Role.role_permissions))
        )
        existing_roles = {role.name: role for role in result.scalars().all()}
        role_permissions_by_name = {
            role.name: list(role.role_permissions) for role in existing_roles.values()
        }

        for role_name, is_system in DEFAULT_ROLES.items():
            role = existing_roles.get(role_name)
            if role is None:
                role = Role(name=role_name, tenant_id=tenant_id, is_system=is_system)
                self.db.add(role)
                await self.db.flush()
                existing_roles[role_name] = role
                role_permissions_by_name[role_name] = []

            desired_permission_ids = {
                permissions[permission_key].id
                for permission_key in DEFAULT_ROLE_PERMISSIONS.get(role_name, set())
                if permission_key in permissions
            }
            role_permissions = role_permissions_by_name[role_name]
            existing_permission_ids = {rp.permission_id for rp in role_permissions}

            for permission_id in desired_permission_ids - existing_permission_ids:
                role_permission = RolePermission(
                    role_id=role.id, permission_id=permission_id
                )
                self.db.add(role_permission)
                role_permissions.append(role_permission)

            for role_permission in list(role_permissions):
                if role_permission.permission_id not in desired_permission_ids:
                    await self.db.delete(role_permission)
                    role_permissions.remove(role_permission)

        await self.db.flush()
        return existing_roles

    async def _ensure_permissions(self) -> dict[str, Permission]:
        result = await self.db.execute(select(Permission))
        permissions = {
            f"{permission.resource}:{permission.action}": permission
            for permission in result.scalars().all()
        }

        for resource, action in PERMISSIONS:
            key = f"{resource}:{action}"
            if key in permissions:
                continue
            permission = Permission(resource=resource, action=action)
            self.db.add(permission)
            await self.db.flush()
            permissions[key] = permission

        return permissions

    async def _resolve_invite_role(
        self,
        tenant_id: UUID,
        role_id: str | None,
        existing_roles: dict[str, Role],
    ) -> Role | None:
        if role_id is None:
            return existing_roles.get("Editor")

        result = await self.db.execute(
            select(Role).where(Role.id == role_id, Role.tenant_id == tenant_id)
        )
        role = result.scalar_one_or_none()
        if role is None:
            raise ValueError("role_not_found")
        return role

    async def _resolve_project(
        self,
        tenant_id: UUID,
        project_id: str | None,
    ) -> Project | None:
        if project_id is None:
            return None

        result = await self.db.execute(
            select(Project).where(Project.id == project_id, Project.tenant_id == tenant_id)
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise ValueError("project_not_found")
        return project

    async def _ensure_user_role(self, user_id: UUID, role_id: UUID) -> None:
        result = await self.db.execute(
            select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role_id)
        )
        if result.scalar_one_or_none() is None:
            self.db.add(UserRole(user_id=user_id, role_id=role_id))

    async def _ensure_project_membership(self, user_id: UUID, project_id: UUID) -> None:
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.user_id == user_id,
                ProjectMember.project_id == project_id,
            )
        )
        if result.scalar_one_or_none() is None:
            self.db.add(
                ProjectMember(project_id=project_id, user_id=user_id, role="member")
            )

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def resolve_display_name(
        clerk_identity: ClerkIdentity,
        preferred_name: str | None = None,
    ) -> str:
        candidate = (preferred_name or "").strip() or clerk_identity.name.strip()
        if candidate:
            return candidate
        return clerk_identity.email.split("@", 1)[0]

    @staticmethod
    def _slugify(value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
        if slug:
            return slug
        return f"tenant-{secrets.token_hex(4)}"
