"""Analytics integrations router — CRUD, test, traffic data, and sync."""

from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsIntegrationCreate,
    AnalyticsIntegrationResponse,
    AnalyticsIntegrationUpdate,
    TrafficSummary,
    TrafficSyncResult,
)
from app.services.analytics import AnalyticsService
from app.services.traffic_sync import TrafficSyncService

router = APIRouter(
    prefix="/projects/{project_id}/analytics",
    tags=["analytics"],
)


async def _verify_project(
    project_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.tenant_id == tenant_id,
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# --- Integration CRUD ---


@router.post(
    "/integrations",
    response_model=AnalyticsIntegrationResponse,
    status_code=201,
)
async def create_integration(
    project_id: UUID,
    body: AnalyticsIntegrationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalyticsIntegrationResponse:
    await _verify_project(project_id, user.tenant_id, db)
    service = AnalyticsService(db)
    integration = await service.create_integration(
        project_id=project_id,
        provider=body.provider,
        external_id=body.external_id,
        credentials=body.credentials,
    )
    await db.commit()
    return AnalyticsIntegrationResponse.model_validate(integration)


@router.get(
    "/integrations",
    response_model=list[AnalyticsIntegrationResponse],
)
async def list_integrations(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AnalyticsIntegrationResponse]:
    await _verify_project(project_id, user.tenant_id, db)
    service = AnalyticsService(db)
    integrations = await service.list_integrations(project_id)
    return [
        AnalyticsIntegrationResponse.model_validate(i) for i in integrations
    ]


@router.put(
    "/integrations/{integration_id}",
    response_model=AnalyticsIntegrationResponse,
)
async def update_integration(
    project_id: UUID,
    integration_id: UUID,
    body: AnalyticsIntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalyticsIntegrationResponse:
    await _verify_project(project_id, user.tenant_id, db)
    service = AnalyticsService(db)
    integration = await service.update_integration(
        integration_id,
        external_id=body.external_id,
        credentials=body.credentials,
        is_active=body.is_active,
    )
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
    await db.commit()
    return AnalyticsIntegrationResponse.model_validate(integration)


@router.delete("/integrations/{integration_id}", status_code=204)
async def delete_integration(
    project_id: UUID,
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await _verify_project(project_id, user.tenant_id, db)
    service = AnalyticsService(db)
    deleted = await service.delete_integration(integration_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Integration not found")
    await db.commit()


@router.post("/integrations/{integration_id}/test")
async def test_integration(
    project_id: UUID,
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    await _verify_project(project_id, user.tenant_id, db)
    sync_service = TrafficSyncService(db)
    success = await sync_service.test_connection(integration_id)
    return {"success": success}


# --- Traffic data ---


@router.get("/traffic", response_model=TrafficSummary)
async def get_traffic(
    project_id: UUID,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    provider: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TrafficSummary:
    await _verify_project(project_id, user.tenant_id, db)

    if end_date is None:
        end_date = date.today() - timedelta(days=1)
    if start_date is None:
        start_date = end_date - timedelta(days=29)

    service = AnalyticsService(db)
    return await service.get_traffic_summary(
        project_id, start_date, end_date, provider
    )


@router.post("/sync", response_model=TrafficSyncResult)
async def sync_traffic(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TrafficSyncResult:
    await _verify_project(project_id, user.tenant_id, db)
    sync_service = TrafficSyncService(db)
    result = await sync_service.sync_project(project_id)
    await db.commit()
    return TrafficSyncResult(synced=result)
