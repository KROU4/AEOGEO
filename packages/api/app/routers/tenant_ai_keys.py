"""Tenant-scoped AI provider API keys (authenticated workspace users)."""

from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.ai_provider_key import AIProviderKey
from app.models.user import User
from app.routers.admin_keys import PROVIDER_TEST_URLS, _to_response
from app.schemas.ai_key import (
    AIProviderKeyCreate,
    AIProviderKeyResponse,
    AIProviderKeyRotate,
)
from app.services.ai_key import AIKeyService
from app.utils.encryption import decrypt_value

router = APIRouter(prefix="/ai-keys", tags=["ai-keys"])


async def _get_tenant_key(
    db: AsyncSession, user: User, key_id: UUID
) -> AIProviderKey:
    service = AIKeyService(db)
    key = await service.get_key(key_id)
    if key is None or key.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ai_key.not_found"},
        )
    return key


@router.get("/", response_model=list[AIProviderKeyResponse])
async def list_my_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIProviderKey)
        .options(selectinload(AIProviderKey.tenant))
        .where(AIProviderKey.tenant_id == user.tenant_id)
        .order_by(AIProviderKey.created_at.desc())
    )
    keys = list(result.scalars().all())
    return [_to_response(k) for k in keys]


@router.post("/", response_model=AIProviderKeyResponse, status_code=201)
async def create_my_key(
    body: AIProviderKeyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AIKeyService(db)
    key = await service.create_key(
        provider=body.provider,
        api_key=body.api_key,
        label=body.label,
        tenant_id=user.tenant_id,
    )
    await db.commit()
    key = await service.get_key(key.id)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "ai_key.persist_failed"},
        )
    return _to_response(key)


@router.put("/{key_id}/rotate", response_model=AIProviderKeyResponse)
async def rotate_my_key(
    key_id: UUID,
    body: AIProviderKeyRotate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_tenant_key(db, user, key_id)
    service = AIKeyService(db)
    key = await service.rotate_key(key_id, body.new_api_key)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ai_key.not_found"},
        )
    await db.commit()
    key = await service.get_key(key_id)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "ai_key.persist_failed"},
        )
    return _to_response(key)


@router.delete("/{key_id}", status_code=204)
async def revoke_my_key(
    key_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_tenant_key(db, user, key_id)
    service = AIKeyService(db)
    revoked = await service.revoke_key(key_id)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ai_key.not_found"},
        )
    await db.commit()


@router.post("/{key_id}/test")
async def test_my_key(
    key_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    key = await _get_tenant_key(db, user, key_id)

    api_key = decrypt_value(key.encrypted_api_key)
    test_url = PROVIDER_TEST_URLS.get(key.provider)
    if test_url is None:
        return {"success": False, "error": f"Unknown provider: {key.provider}"}

    try:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if key.provider == "openai" or key.provider == "openrouter":
            headers["Authorization"] = f"Bearer {api_key}"
        elif key.provider == "anthropic":
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"

        async with httpx.AsyncClient(timeout=15.0) as client:
            if key.provider == "google":
                resp = await client.get(f"{test_url}?key={api_key}")
            else:
                resp = await client.get(test_url, headers=headers)

        if resp.status_code < 400:
            return {"success": True}
        return {"success": False, "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
