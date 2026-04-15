"""Project-scoped dashboard aggregates (`/projects/{id}/dashboard`)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.brand import Brand
from app.models.project import Project
from app.models.user import User
from app.schemas.project_dashboard_contract import (
    DashboardPlatformsResponse,
    ProjectDashboardResponse,
)
from app.services.project_dashboard_metrics import (
    build_platforms_table,
    build_project_dashboard,
)

router = APIRouter(tags=["project-dashboard"])


async def _verify_project(
    project_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.tenant_id == tenant_id,
        ),
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_id}/dashboard", response_model=ProjectDashboardResponse)
async def get_project_dashboard(
    project_id: UUID,
    period: str = Query(
        default="7d",
        description="7d, 30d, or 90d",
        pattern="^(7d|30d|90d)$",
    ),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectDashboardResponse:
    await _verify_project(project_id, user.tenant_id, db)
    brand_row = await db.execute(
        select(Brand).where(Brand.project_id == project_id).limit(1),
    )
    brand = brand_row.scalar_one_or_none()
    return await build_project_dashboard(db, project_id, period, brand)


@router.get(
    "/projects/{project_id}/dashboard/platforms",
    response_model=DashboardPlatformsResponse,
)
async def get_project_dashboard_platforms(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardPlatformsResponse:
    await _verify_project(project_id, user.tenant_id, db)
    return await build_platforms_table(db, project_id)
