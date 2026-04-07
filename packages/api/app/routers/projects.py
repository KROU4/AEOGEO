import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdate,
    _sanitize_domain,
)
from app.services.project import ProjectService
from app.utils.pagination import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=PaginatedResponse[ProjectResponse])
async def list_projects(
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[ProjectResponse]:
    service = ProjectService(db)
    return await service.list_projects(user.tenant_id, cursor, limit)


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectResponse:
    service = ProjectService(db)
    return await service.create_project(user.tenant_id, user.id, body)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectResponse:
    service = ProjectService(db)
    result = await service.get_project_response(project_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectResponse:
    service = ProjectService(db)
    result = await service.update_project(project_id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = ProjectService(db)
    deleted = await service.delete_project(project_id, user.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}


@router.get(
    "/{project_id}/members", response_model=list[ProjectMemberResponse]
)
async def list_members(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProjectMemberResponse]:
    service = ProjectService(db)
    result = await service.list_members(project_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=201,
)
async def add_member(
    project_id: UUID,
    body: ProjectMemberAdd,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectMemberResponse:
    service = ProjectService(db)
    try:
        result = await service.add_member(
            project_id, user.tenant_id, body.user_id, body.role
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    if result is None:
        raise HTTPException(
            status_code=404, detail="Project or user not found"
        )
    return result


# ------------------------------------------------------------------
# Domain reachability check
# ------------------------------------------------------------------


class DomainCheckRequest(BaseModel):
    domain: str


class DomainCheckResponse(BaseModel):
    valid: bool
    domain: str | None = None
    reachable: bool = False
    error: str | None = None


@router.post("/check-domain", response_model=DomainCheckResponse)
async def check_domain(
    body: DomainCheckRequest,
    _user: User = Depends(get_current_user),
) -> DomainCheckResponse:
    """Sanitize a domain and check if it is reachable."""
    cleaned = _sanitize_domain(body.domain)
    if not cleaned:
        return DomainCheckResponse(
            valid=False, error="invalid_domain"
        )

    url = f"https://{cleaned}"
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=8
        ) as client:
            resp = await client.head(url)
            if resp.status_code >= 500:
                raise httpx.HTTPStatusError(
                    "server error",
                    request=resp.request,
                    response=resp,
                )
        return DomainCheckResponse(
            valid=True, domain=cleaned, reachable=True
        )
    except Exception as exc:
        logger.debug("Domain check failed for %s: %s", cleaned, exc)
        return DomainCheckResponse(
            valid=True,
            domain=cleaned,
            reachable=False,
            error="unreachable",
        )
