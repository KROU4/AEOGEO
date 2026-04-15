"""Project-scoped answer detail (highlight spans for UI)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project_answer import ProjectAnswerDetailResponse
from app.services.answer_highlights import build_project_answer_detail

router = APIRouter(tags=["project-answers"])


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


@router.get(
    "/projects/{project_id}/answers/{answer_id}",
    response_model=ProjectAnswerDetailResponse,
)
async def get_project_answer(
    project_id: UUID,
    answer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectAnswerDetailResponse:
    await _verify_project(project_id, user.tenant_id, db)
    detail = await build_project_answer_detail(db, project_id, answer_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    return detail
