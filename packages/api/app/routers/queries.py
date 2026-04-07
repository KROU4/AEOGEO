"""Query router — CRUD for query sets, queries, AI generation, and clustering."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.dependencies import get_current_user, get_db, get_redis
from app.models.project import Project
from app.models.user import User
from app.schemas.query import (
    BatchQueryStatusUpdate,
    QueryClusterResponse,
    QueryCreate,
    QueryGenerateRequest,
    QueryResponse,
    QuerySetCreate,
    QuerySetResponse,
    QuerySetUpdate,
    QueryUpdate,
)
from app.services.ai_client import AIClient
from app.services.query_agent import QueryAgentService
from app.utils.pagination import PaginatedResponse

router = APIRouter(
    prefix="/projects/{project_id}/query-sets", tags=["queries"]
)


# ------------------------------------------------------------------
# Query Sets
# ------------------------------------------------------------------


@router.post("", response_model=QuerySetResponse, status_code=201)
async def create_query_set(
    project_id: UUID,
    body: QuerySetCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuerySetResponse:
    service = QueryAgentService(db)
    result = await service.create_query_set(project_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.get("", response_model=PaginatedResponse[QuerySetResponse])
async def list_query_sets(
    project_id: UUID,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[QuerySetResponse]:
    service = QueryAgentService(db)
    return await service.list_query_sets(project_id, cursor, limit)


@router.get("/{query_set_id}", response_model=QuerySetResponse)
async def get_query_set(
    project_id: UUID,
    query_set_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuerySetResponse:
    service = QueryAgentService(db)
    result = await service.get_query_set(query_set_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Query set not found")
    return result


@router.put("/{query_set_id}", response_model=QuerySetResponse)
async def update_query_set(
    project_id: UUID,
    query_set_id: UUID,
    body: QuerySetUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuerySetResponse:
    service = QueryAgentService(db)
    result = await service.update_query_set(query_set_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Query set not found")
    return result


@router.delete("/{query_set_id}", status_code=204)
async def delete_query_set(
    project_id: UUID,
    query_set_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    service = QueryAgentService(db)
    deleted = await service.delete_query_set(query_set_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Query set not found")
    return Response(status_code=204)


# ------------------------------------------------------------------
# AI Generation & Clustering
# ------------------------------------------------------------------


@router.post("/{query_set_id}/generate")
async def generate_queries(
    project_id: UUID,
    query_set_id: UUID,
    body: QueryGenerateRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> dict:
    ai_client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    service = QueryAgentService(db)
    try:
        result = await service.generate_queries(
            query_set_id, project_id, ai_client, body.count
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"generated": len(result), "queries": result}


@router.post("/{query_set_id}/cluster")
async def cluster_queries(
    project_id: UUID,
    query_set_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> dict:
    ai_client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    project = await db.scalar(select(Project).where(Project.id == project_id))
    content_locale = project.content_locale if project else "en"
    service = QueryAgentService(db)
    try:
        result = await service.cluster_queries(query_set_id, ai_client, content_locale)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"clusters": result}


# ------------------------------------------------------------------
# Queries within a Query Set
# ------------------------------------------------------------------


@router.get(
    "/{query_set_id}/queries",
    response_model=PaginatedResponse[QueryResponse],
)
async def list_queries(
    project_id: UUID,
    query_set_id: UUID,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    category: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[QueryResponse]:
    service = QueryAgentService(db)
    return await service.list_queries(
        query_set_id,
        category=category,
        status=status,
        cursor=cursor,
        limit=limit,
    )


@router.post(
    "/{query_set_id}/queries",
    response_model=QueryResponse,
    status_code=201,
)
async def add_query(
    project_id: UUID,
    query_set_id: UUID,
    body: QueryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QueryResponse:
    service = QueryAgentService(db)
    result = await service.create_query(query_set_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Query set not found")
    return result


@router.put(
    "/{query_set_id}/queries/{query_id}", response_model=QueryResponse
)
async def update_query(
    project_id: UUID,
    query_set_id: UUID,
    query_id: UUID,
    body: QueryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QueryResponse:
    service = QueryAgentService(db)
    result = await service.update_query(query_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Query not found")
    return result


@router.delete("/{query_set_id}/queries/{query_id}", status_code=204)
async def delete_query(
    project_id: UUID,
    query_set_id: UUID,
    query_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    service = QueryAgentService(db)
    deleted = await service.delete_query(query_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Query not found")
    return Response(status_code=204)


@router.post(
    "/{query_set_id}/queries/batch-update",
    response_model=dict,
)
async def batch_update_queries(
    project_id: UUID,
    query_set_id: UUID,
    body: BatchQueryStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = QueryAgentService(db)
    updated_count = await service.batch_update_status(
        body.query_ids, body.status
    )
    return {"updated": updated_count}


# ------------------------------------------------------------------
# Clusters
# ------------------------------------------------------------------


@router.get(
    "/{query_set_id}/clusters",
    response_model=list[QueryClusterResponse],
)
async def list_clusters(
    project_id: UUID,
    query_set_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[QueryClusterResponse]:
    service = QueryAgentService(db)
    result = await service.list_clusters(query_set_id)
    return result
