"""Engines router — real CRUD for AI engine registry."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.engine import EngineCreate, EngineResponse, EngineUpdate
from app.services.engine import EngineService

router = APIRouter(prefix="/engines", tags=["engines"])


@router.get("/", response_model=list[EngineResponse])
async def list_engines(
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[EngineResponse]:
    service = EngineService(db)
    return await service.list_engines(is_active=is_active)


@router.post("/", response_model=EngineResponse, status_code=201)
async def create_engine(
    body: EngineCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineResponse:
    service = EngineService(db)
    return await service.create_engine(body)


@router.get("/{engine_id}", response_model=EngineResponse)
async def get_engine(
    engine_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineResponse:
    service = EngineService(db)
    result = await service.get_engine(engine_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Engine not found")
    return result


@router.put("/{engine_id}", response_model=EngineResponse)
async def update_engine(
    engine_id: UUID,
    body: EngineUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EngineResponse:
    service = EngineService(db)
    result = await service.update_engine(engine_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Engine not found")
    return result


@router.delete("/{engine_id}")
async def delete_engine(
    engine_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = EngineService(db)
    deleted = await service.delete_engine(engine_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Engine not found")
    return {"message": "Engine deleted"}
