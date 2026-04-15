"""Project explorer: SOV, trends, citations, competitor comparison."""

from datetime import date
from urllib.parse import unquote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.brand import Brand
from app.models.project import Project
from app.models.user import User
from app.schemas.platform_queries import PlatformQueriesResponse
from app.schemas.project_explorer import (
    CitationDomainDetailResponse,
    CitationsListResponse,
    CompetitorsComparisonResponse,
    CompetitorsInsightResponse,
    ProjectSovResponse,
    ProjectTrendsResponse,
)
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)
from app.services.platform_queries_list import list_platform_queries
from app.services.project_explorer_metrics import (
    build_citation_domain_detail,
    build_citations_list,
    build_competitors_comparison,
    build_sov,
    build_trends,
)

router = APIRouter(tags=["project-explorer"])


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


async def _load_brand(
    db: AsyncSession,
    project_id: UUID,
) -> Brand | None:
    r = await db.execute(
        select(Brand).where(Brand.project_id == project_id).limit(1),
    )
    return r.scalar_one_or_none()


@router.get("/projects/{project_id}/sov", response_model=ProjectSovResponse)
async def get_project_sov(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectSovResponse:
    project = await _verify_project(project_id, user.tenant_id, db)
    brand = await _load_brand(db, project_id)
    return await build_sov(db, project_id, brand, project)


@router.get("/projects/{project_id}/trends", response_model=ProjectTrendsResponse)
async def get_project_trends(
    project_id: UUID,
    weeks: int = Query(default=12, ge=4, le=52),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectTrendsResponse:
    project = await _verify_project(project_id, user.tenant_id, db)
    brand = await _load_brand(db, project_id)
    return await build_trends(db, project_id, weeks, brand, project)


@router.get(
    "/projects/{project_id}/citations",
    response_model=CitationsListResponse,
)
async def list_project_citations(
    project_id: UUID,
    engine: str = Query(default="all"),
    domain: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CitationsListResponse:
    project = await _verify_project(project_id, user.tenant_id, db)
    brand = await _load_brand(db, project_id)
    return await build_citations_list(
        db,
        project_id,
        brand,
        project,
        engine_filter=engine,
        domain_filter=domain,
        page=page,
        limit=limit,
    )


@router.get(
    "/projects/{project_id}/citations/{domain}/detail",
    response_model=CitationDomainDetailResponse,
)
async def get_citation_domain_detail(
    project_id: UUID,
    domain: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CitationDomainDetailResponse:
    await _verify_project(project_id, user.tenant_id, db)
    dom = unquote(domain)
    detail = await build_citation_domain_detail(db, project_id, dom)
    if detail is None:
        raise HTTPException(status_code=404, detail="No citations for this domain")
    return detail


@router.get(
    "/projects/{project_id}/competitors/comparison",
    response_model=CompetitorsComparisonResponse,
)
async def get_competitors_comparison(
    project_id: UUID,
    period: str = Query(
        default="7d",
        pattern="^(7d|30d|90d)$",
    ),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CompetitorsComparisonResponse:
    project = await _verify_project(project_id, user.tenant_id, db)
    brand = await _load_brand(db, project_id)
    return await build_competitors_comparison(
        db, project_id, project, brand, period,
    )


@router.get(
    "/projects/{project_id}/competitors/insights",
    response_model=CompetitorsInsightResponse,
)
async def get_competitors_insights(
    project_id: UUID,
    period: str = Query(
        default="7d",
        pattern="^(7d|30d|90d)$",
    ),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> CompetitorsInsightResponse:
    project = await _verify_project(project_id, user.tenant_id, db)
    brand = await _load_brand(db, project_id)
    cache_key = f"insights:{project_id}:{date.today().isoformat()}:{period}"
    cached = await redis.get(cache_key)
    if cached:
        return CompetitorsInsightResponse(insight=cached.decode("utf-8"))

    data = await build_competitors_comparison(
        db, project_id, project, brand, period,
    )
    if not data.brands:
        msg = (
            "Not enough competitor or mention data yet. "
            "Run a full pipeline and ensure competitors are configured."
        )
        await redis.setex(cache_key, 300, msg)
        return CompetitorsInsightResponse(insight=msg)
    lines = [
        f"{b.domain} (client={b.is_client}): overall SoV {b.overall_sov}% "
        + ", ".join(f"{k} sov={v.sov} rank={v.rank}" for k, v in b.by_platform.items())
        for b in data.brands
    ]
    prompt = (
        "Competitor visibility snapshot (GEO / AI answers):\n"
        + "\n".join(lines)
        + "\n\nWrite 2–3 sentences: who leads where, largest gap vs client, "
        "one concrete priority. Use numbers."
    )
    client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    try:
        ai = await client.complete(
            provider="openai",
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are AVOP Intelligence. Be concise and data-driven.",
                },
                {"role": "user", "content": prompt},
            ],
            request_type="competitors_insight",
            temperature=0.35,
            max_tokens=400,
        )
    except UsageLimitError:
        raise HTTPException(status_code=429, detail="usage.limit_reached")
    except RateLimitError:
        raise HTTPException(status_code=429, detail="rate_limited")
    except NoAPIKeyError:
        raise HTTPException(status_code=503, detail="ai_key.not_found")
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    text = ai.content.strip()
    await redis.setex(cache_key, 3600, text)
    return CompetitorsInsightResponse(insight=text)


@router.get(
    "/projects/{project_id}/platforms/{engine}/queries",
    response_model=PlatformQueriesResponse,
)
async def get_platform_queries(
    project_id: UUID,
    engine: str,
    sort: str = Query(
        default="date",
        pattern="^(rank|date|citation_rate)$",
    ),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlatformQueriesResponse:
    await _verify_project(project_id, user.tenant_id, db)
    eng_slug = engine.strip().lower()
    out = await list_platform_queries(
        db,
        project_id,
        eng_slug,
        sort=sort,
        order=order,
        page=page,
        page_size=limit,
    )
    if out is None:
        raise HTTPException(status_code=404, detail="Unknown engine slug")
    return out
