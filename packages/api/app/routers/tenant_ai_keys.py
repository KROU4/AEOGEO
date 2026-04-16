"""Tenant-scoped AI provider API keys (authenticated workspace users).

Keys are resolved from server environment variables only; this router keeps
empty list / 403 responses so older clients do not break on missing routes.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.ai_key import (
    AIProviderKeyCreate,
    AIProviderKeyResponse,
    AIProviderKeyRotate,
)

router = APIRouter(prefix="/ai-keys", tags=["ai-keys"])

_ENV_ONLY_DETAIL: dict[str, str] = {
    "code": "ai_key.env_only",
    "message": (
        "AI provider keys are set only via server environment variables "
        "(OPENAI_API_KEY, OPENROUTER_API_KEY, …), not in the app UI."
    ),
}


@router.get("/", response_model=list[AIProviderKeyResponse])
async def list_my_keys(
    _user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
):
    return []


@router.post("/", response_model=AIProviderKeyResponse, status_code=201)
async def create_my_key(
    _body: AIProviderKeyCreate,
    _user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)


@router.put("/{key_id}/rotate", response_model=AIProviderKeyResponse)
async def rotate_my_key(
    _key_id: UUID,
    _body: AIProviderKeyRotate,
    _user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)


@router.delete("/{key_id}", status_code=204)
async def revoke_my_key(
    _key_id: UUID,
    _user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)


@router.post("/{key_id}/test")
async def test_my_key(
    _key_id: UUID,
    _user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ENV_ONLY_DETAIL)
