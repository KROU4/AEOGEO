"""Schedule management router — create, list, update, and delete scheduled runs."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.scheduled_run import (
    ScheduledRunCreate,
    ScheduledRunResponse,
    ScheduledRunUpdate,
)
from app.services.scheduler import SchedulerService

router = APIRouter(
    prefix="/projects/{project_id}/schedules",
    tags=["schedules"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _verify_project(
    project_id: UUID,
    tenant_id: UUID,
    db: AsyncSession,
) -> Project:
    """Return the project or raise 404."""
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


# ---------------------------------------------------------------------------
# POST /projects/{project_id}/schedules — Create schedule
# ---------------------------------------------------------------------------

@router.post("", response_model=ScheduledRunResponse, status_code=201)
async def create_schedule(
    project_id: UUID,
    body: ScheduledRunCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledRunResponse:
    await _verify_project(project_id, user.tenant_id, db)
    svc = SchedulerService(db)
    return await svc.create_schedule(project_id, body)


# ---------------------------------------------------------------------------
# GET /projects/{project_id}/schedules — List schedules
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ScheduledRunResponse])
async def list_schedules(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ScheduledRunResponse]:
    await _verify_project(project_id, user.tenant_id, db)
    svc = SchedulerService(db)
    return await svc.list_schedules(project_id)


# ---------------------------------------------------------------------------
# PUT /projects/{project_id}/schedules/{schedule_id} — Update (pause/resume/modify)
# ---------------------------------------------------------------------------

@router.put("/{schedule_id}", response_model=ScheduledRunResponse)
async def update_schedule(
    project_id: UUID,
    schedule_id: UUID,
    body: ScheduledRunUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledRunResponse:
    await _verify_project(project_id, user.tenant_id, db)
    svc = SchedulerService(db)
    result = await svc.update_schedule(schedule_id, project_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return result


# ---------------------------------------------------------------------------
# DELETE /projects/{project_id}/schedules/{schedule_id} — Delete
# ---------------------------------------------------------------------------

@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    project_id: UUID,
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await _verify_project(project_id, user.tenant_id, db)
    svc = SchedulerService(db)
    deleted = await svc.delete_schedule(schedule_id, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found")
