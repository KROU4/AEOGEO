"""Admin AI key management endpoints — super-admin only."""

from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_system_admin
from app.models.user import User
from app.schemas.ai_key import (
    AIProviderKeyCreate,
    AIProviderKeyResponse,
    AIProviderKeyRotate,
)
from app.services.ai_key import AIKeyService

router = APIRouter(
    prefix="/admin/ai-keys",
    tags=["admin"],
)

PROVIDER_TEST_URLS = {
    "openai": "https://api.openai.com/v1/models",
    "anthropic": "https://api.anthropic.com/v1/messages",
    "google": "https://generativelanguage.googleapis.com/v1beta/models",
    "openrouter": "https://openrouter.ai/api/v1/models",
}


def _to_response(key) -> AIProviderKeyResponse:
    return AIProviderKeyResponse(
        id=key.id,
        provider=key.provider,
        label=key.label,
        key_hint=AIKeyService.mask_key(key.encrypted_api_key),
        tenant_id=key.tenant_id,
        tenant_name=key.tenant.name if key.tenant else None,
        is_active=key.is_active,
        last_used_at=key.last_used_at,
        last_rotated_at=key.last_rotated_at,
        created_at=key.created_at,
    )


@router.get("/", response_model=list[AIProviderKeyResponse])
async def list_keys(
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AIKeyService(db)
    keys = await service.list_keys()
    return [_to_response(k) for k in keys]


@router.post("/", response_model=AIProviderKeyResponse, status_code=201)
async def create_key(
    body: AIProviderKeyCreate,
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AIKeyService(db)
    key = await service.create_key(
        provider=body.provider,
        api_key=body.api_key,
        label=body.label,
        tenant_id=body.tenant_id,
    )
    await db.commit()
    await db.refresh(key)
    # Re-fetch with relationship loaded
    key = await service.get_key(key.id)
    return _to_response(key)


@router.put("/{key_id}/rotate", response_model=AIProviderKeyResponse)
async def rotate_key(
    key_id: UUID,
    body: AIProviderKeyRotate,
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AIKeyService(db)
    key = await service.rotate_key(key_id, body.new_api_key)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ai_key.not_found"},
        )
    await db.commit()
    key = await service.get_key(key_id)
    return _to_response(key)


@router.delete("/{key_id}", status_code=204)
async def revoke_key(
    key_id: UUID,
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AIKeyService(db)
    revoked = await service.revoke_key(key_id)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ai_key.not_found"},
        )
    await db.commit()


@router.post("/{key_id}/test")
async def test_key(
    key_id: UUID,
    _admin: User = Depends(get_system_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AIKeyService(db)
    key = await service.get_key(key_id)
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ai_key.not_found"},
        )

    from app.utils.encryption import decrypt_value

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
