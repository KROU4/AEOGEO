"""Admin AI key management endpoints — super-admin only.

Keys are resolved from server environment variables only; routes return empty
list / 403 so older clients keep working.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_system_admin
from app.models.user import User
from app.schemas.ai_key import (
    AIProviderKeyCreate,
    AIProviderKeyResponse,
    AIProviderKeyRotate,
)

router = APIRouter(
    prefix="/admin/ai-keys",
    tags=["admin"],
)

_ENV_ONLY_DETAIL: dict[str, str] = {
    "code": "ai_key.env_only",
    "message": (
        "AI provider keys are set only via server environment variables "
        "(OPENAI_API_KEY, OPENROUTER_API_KEY, …), not in the app UI."
    ),
}


@router.get("/", response_model=list[AIProviderKeyResponse])
async def list_keys(
    _admin: User = Depends(get_system_admin),
    _db: AsyncSession = Depends(get_db),
):
    return []


@router.post("/", response_model=AIProviderKeyResponse, status_code=201)
async def create_key(
    _body: AIProviderKeyCreate,
    _admin: User = Depends(get_system_admin),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)


@router.put("/{key_id}/rotate", response_model=AIProviderKeyResponse)
async def rotate_key(
    _key_id: UUID,
    _body: AIProviderKeyRotate,
    _admin: User = Depends(get_system_admin),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)


@router.delete("/{key_id}", status_code=204)
async def revoke_key(
    _key_id: UUID,
    _admin: User = Depends(get_system_admin),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)


@router.post("/{key_id}/test")
async def test_key(
    _key_id: UUID,
    _admin: User = Depends(get_system_admin),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)
