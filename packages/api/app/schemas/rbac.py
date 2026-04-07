from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RoleCreate(BaseModel):
    name: str
    description: str = ""


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    resource: str
    action: str
    description: str | None = None


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    is_system: bool
    created_at: datetime
    permissions: list[str]  # ["resource:action", ...]


class RolePermissionUpdate(BaseModel):
    permission_ids: list[UUID]
