"""Roles router — real CRUD for roles, permissions, and user-role assignments."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.rbac import (
    PermissionResponse,
    RoleCreate,
    RolePermissionUpdate,
    RoleResponse,
    RoleUpdate,
)
from app.services.role import RoleService

router = APIRouter(prefix="/roles", tags=["roles"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _role_to_response(role) -> RoleResponse:
    """Convert a Role ORM object to RoleResponse schema."""
    permissions = [
        f"{rp.permission.resource}:{rp.permission.action}"
        for rp in role.role_permissions
    ]
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        created_at=role.created_at,
        permissions=permissions,
    )


# ---------------------------------------------------------------------------
# Role CRUD
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RoleResponse]:
    """List all roles for the current tenant."""
    service = RoleService(db)
    roles = await service.list_roles(user.tenant_id)
    return [_role_to_response(r) for r in roles]


@router.post("/", response_model=RoleResponse, status_code=201)
async def create_role(
    body: RoleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RoleResponse:
    """Create a new custom role."""
    service = RoleService(db)
    role = await service.create_role(user.tenant_id, body.name, body.description)
    return _role_to_response(role)


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RoleResponse:
    """Get a single role with its permissions."""
    service = RoleService(db)
    role = await service.get_role(role_id, user.tenant_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return _role_to_response(role)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    body: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RoleResponse:
    """Update a role's name and/or description."""
    service = RoleService(db)
    try:
        role = await service.update_role(
            role_id, user.tenant_id, body.name, body.description
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return _role_to_response(role)


@router.delete("/{role_id}")
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Delete a custom role. System roles cannot be deleted."""
    service = RoleService(db)
    try:
        deleted = await service.delete_role(role_id, user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not deleted:
        raise HTTPException(status_code=404, detail="Role not found")
    return {"message": "Role deleted"}


# ---------------------------------------------------------------------------
# Role permissions
# ---------------------------------------------------------------------------


@router.get("/{role_id}/permissions", response_model=list[PermissionResponse])
async def get_role_permissions(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PermissionResponse]:
    """Get all permissions assigned to a role."""
    service = RoleService(db)

    # Verify role exists
    role = await service.get_role(role_id, user.tenant_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")

    permissions = await service.get_role_permissions(role_id, user.tenant_id)
    return [
        PermissionResponse(
            id=p.id,
            resource=p.resource,
            action=p.action,
            description=p.description,
        )
        for p in permissions
    ]


@router.put("/{role_id}/permissions", response_model=list[PermissionResponse])
async def set_role_permissions(
    role_id: UUID,
    body: RolePermissionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PermissionResponse]:
    """Replace all permissions for a role."""
    service = RoleService(db)
    try:
        permissions = await service.set_role_permissions(
            role_id, user.tenant_id, body.permission_ids
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return [
        PermissionResponse(
            id=p.id,
            resource=p.resource,
            action=p.action,
            description=p.description,
        )
        for p in permissions
    ]


# ---------------------------------------------------------------------------
# User-role assignments
# ---------------------------------------------------------------------------


@router.post("/{role_id}/users/{user_id}")
async def assign_role_to_user(
    role_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Assign a role to a user."""
    service = RoleService(db)
    try:
        created = await service.assign_role_to_user(user_id, role_id, user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not created:
        return {"message": "Role already assigned to user"}
    return {"message": "Role assigned to user"}


@router.delete("/{role_id}/users/{user_id}")
async def remove_role_from_user(
    role_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Remove a role from a user."""
    service = RoleService(db)
    try:
        removed = await service.remove_role_from_user(user_id, role_id, user.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not removed:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    return {"message": "Role removed from user"}
