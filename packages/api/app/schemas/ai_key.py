from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AIProviderKeyCreate(BaseModel):
    provider: str
    api_key: str
    label: str
    tenant_id: UUID | None = None


class AIProviderKeyRotate(BaseModel):
    new_api_key: str


class AIProviderKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: str
    label: str
    key_hint: str
    tenant_id: UUID | None
    tenant_name: str | None = None
    is_active: bool
    last_used_at: datetime | None = None
    last_rotated_at: datetime | None = None
    created_at: datetime
