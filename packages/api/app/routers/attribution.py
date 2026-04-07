"""Attribution router — before/after content impact on visibility scores."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.content import Content
from app.models.project import Project
from app.models.user import User
from app.services.attribution import AttributionService

router = APIRouter(
    prefix="/projects/{project_id}/attribution",
    tags=["attribution"],
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


async def _verify_content_in_project(
    content_id: UUID,
    project_id: UUID,
    db: AsyncSession,
) -> Content:
    """Return the content item or raise 404."""
    result = await db.execute(
        select(Content).where(
            Content.id == content_id,
            Content.project_id == project_id,
        )
    )
    content = result.scalar_one_or_none()
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


# ---------------------------------------------------------------------------
# GET /projects/{pid}/attribution/summary
# ---------------------------------------------------------------------------

@router.get("/summary")
async def get_attribution_summary(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """High-level attribution metrics for a project.

    Returns total published content count, how many have measurable impact,
    average impact, best/worst performing content, and a score trajectory
    over time.
    """
    await _verify_project(project_id, user.tenant_id, db)

    svc = AttributionService(db)
    return await svc.get_attribution_summary(project_id)


# ---------------------------------------------------------------------------
# GET /projects/{pid}/attribution/content
# ---------------------------------------------------------------------------

@router.get("/content")
async def list_content_attribution(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """List all published content with before/after impact scores.

    Sorted by impact (highest first). Items without measurable impact
    (missing a before or after engine run) are placed at the end.
    """
    await _verify_project(project_id, user.tenant_id, db)

    svc = AttributionService(db)
    return await svc.get_project_attribution(project_id)


# ---------------------------------------------------------------------------
# GET /projects/{pid}/attribution/content/{cid}
# ---------------------------------------------------------------------------

@router.get("/content/{content_id}")
async def get_content_impact(
    project_id: UUID,
    content_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Detailed before/after impact for a single content item.

    Shows which visibility dimensions improved, the delta per dimension,
    and the overall impact on the total score.
    """
    await _verify_project(project_id, user.tenant_id, db)
    await _verify_content_in_project(content_id, project_id, db)

    svc = AttributionService(db)
    result = await svc.get_content_impact(content_id)

    if result is None:
        raise HTTPException(status_code=404, detail="Content not found")

    return result
