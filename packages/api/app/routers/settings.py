from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from redis.asyncio import Redis

from app.dependencies import get_current_user, get_redis
from app.models.user import User
from app.schemas.settings import IntegrationSettingsResponse, IntegrationSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_INTEGRATION_SETTINGS = IntegrationSettingsResponse()


def _integration_key(tenant_id: str) -> str:
    return f"tenant:{tenant_id}:integrations"


async def _load_integration_settings(
    redis: Redis,
    tenant_id: str,
) -> IntegrationSettingsResponse:
    raw = await redis.get(_integration_key(tenant_id))
    if not raw:
        return DEFAULT_INTEGRATION_SETTINGS

    data = json.loads(raw)
    return IntegrationSettingsResponse.model_validate(data)


@router.get("/integrations", response_model=IntegrationSettingsResponse)
async def get_integrations(
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> IntegrationSettingsResponse:
    return await _load_integration_settings(redis, str(user.tenant_id))


@router.patch("/integrations", response_model=IntegrationSettingsResponse)
async def patch_integrations(
    body: IntegrationSettingsUpdate,
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> IntegrationSettingsResponse:
    current = await _load_integration_settings(redis, str(user.tenant_id))
    payload = body.model_dump(exclude_none=True)
    merged = IntegrationSettingsResponse.model_validate(
        {**current.model_dump(), **payload}
    )
    await redis.set(_integration_key(str(user.tenant_id)), merged.model_dump_json())
    return merged
