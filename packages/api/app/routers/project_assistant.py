"""Streaming AI assistant summaries for a project."""

import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.brand import Brand
from app.models.engine_run import EngineRun
from app.models.project import Project
from app.models.user import User
from app.schemas.assistant_chat import AssistantChatRequest
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)
from app.services.project_dashboard_metrics import build_project_dashboard
from app.services.scoring import ScoringService

router = APIRouter(prefix="/projects/{project_id}/assistant", tags=["assistant"])


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


async def _latest_completed_run(
    db: AsyncSession,
    project_id: UUID,
) -> EngineRun | None:
    result = await db.execute(
        select(EngineRun)
        .where(
            EngineRun.project_id == project_id,
            EngineRun.status == "completed",
        )
        .order_by(EngineRun.created_at.desc())
        .limit(1),
    )
    return result.scalar_one_or_none()


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.get("/summary")
async def assistant_summary_stream(
    project_id: UUID,
    run_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> StreamingResponse:
    await _verify_project(project_id, user.tenant_id, db)

    if run_id is not None:
        run_result = await db.execute(
            select(EngineRun).where(
                EngineRun.id == run_id,
                EngineRun.project_id == project_id,
            ),
        )
        run = run_result.scalar_one_or_none()
        if run is None:
            raise HTTPException(status_code=404, detail="Run not found")
    else:
        run = await _latest_completed_run(db, project_id)
        if run is None:
            raise HTTPException(
                status_code=404,
                detail="No completed runs for this project",
            )

    svc = ScoringService(db)
    metrics = await svc.get_run_summary(run.id)
    user_payload = (
        f"Latest run metrics (scores 0–10 scale): avg total {metrics['avg_total']}, "
        f"mention {metrics['avg_mention']}, sentiment {metrics['avg_sentiment']}, "
        f"position {metrics['avg_position']}, citation {metrics['avg_citation']}, "
        f"recommendation {metrics['avg_recommendation']}. "
        f"Write exactly three short sentences for an executive: trend, strongest "
        f"signal, one priority action. Be specific with numbers."
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are AVOP Intelligence, a GEO visibility analyst. "
                "Respond in clear, confident English."
            ),
        },
        {"role": "user", "content": user_payload},
    ]

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
            messages=messages,
            request_type="assistant_summary",
            temperature=0.4,
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

    text = ai.content

    async def event_stream() -> AsyncIterator[str]:
        step = max(12, len(text) // 24)
        for i in range(0, len(text), step):
            yield _sse({"chunk": text[i : i + step]})
        yield _sse({"done": True, "full_text": text})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/report")
async def assistant_report_stream(
    project_id: UUID,
    period: str = Query(
        default="7d",
        pattern="^(7d|30d|90d)$",
    ),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> StreamingResponse:
    project = await _verify_project(project_id, user.tenant_id, db)
    brand_row = await db.execute(
        select(Brand).where(Brand.project_id == project_id).limit(1),
    )
    brand = brand_row.scalar_one_or_none()
    dash = await build_project_dashboard(db, project_id, period, brand)
    payload = dash.model_dump(mode="json")
    user_payload = (
        "You are AVOP Intelligence. Write a 4–5 sentence professional GEO "
        "visibility report for an executive. Use the JSON metrics below. "
        "Name platforms explicitly, cite deltas, end with one priority action.\n\n"
        f"{json.dumps(payload)}"
    )
    messages = [
        {
            "role": "system",
            "content": (
                f"Project context: domain={project.domain or 'unknown'}, "
                f"name={project.name!r}."
            ),
        },
        {"role": "user", "content": user_payload},
    ]
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
            messages=messages,
            request_type="assistant_report",
            temperature=0.35,
            max_tokens=900,
        )
    except UsageLimitError:
        raise HTTPException(status_code=429, detail="usage.limit_reached")
    except RateLimitError:
        raise HTTPException(status_code=429, detail="rate_limited")
    except NoAPIKeyError:
        raise HTTPException(status_code=503, detail="ai_key.not_found")
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    text = ai.content

    async def event_stream() -> AsyncIterator[str]:
        step = max(20, len(text) // 32)
        for i in range(0, len(text), step):
            yield _sse({"chunk": text[i : i + step]})
        yield _sse({"done": True, "full_text": text})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/chat")
async def assistant_chat_stream(
    project_id: UUID,
    body: AssistantChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> StreamingResponse:
    project = await _verify_project(project_id, user.tenant_id, db)
    ctx = (
        f"You are AVOP Intelligence, a GEO visibility copilot. "
        f"Project: {project.name!r}, domain: {project.domain or 'unknown'}. "
        f"Answer using concise paragraphs. If data is missing, say so."
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": ctx}]
    for h in body.history[-20:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": body.message})

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
            messages=messages,
            request_type="assistant_chat",
            temperature=0.4,
            max_tokens=1200,
        )
    except UsageLimitError:
        raise HTTPException(status_code=429, detail="usage.limit_reached")
    except RateLimitError:
        raise HTTPException(status_code=429, detail="rate_limited")
    except NoAPIKeyError:
        raise HTTPException(status_code=503, detail="ai_key.not_found")
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    text = ai.content

    async def event_stream() -> AsyncIterator[str]:
        step = max(16, len(text) // 28)
        for i in range(0, len(text), step):
            yield _sse({"chunk": text[i : i + step]})
        yield _sse({"done": True, "full_text": text})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
