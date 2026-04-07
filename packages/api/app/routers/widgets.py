from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.widget import (
    EmbedCodeResponse,
    WidgetAnalyticsResponse,
    WidgetCreate,
    WidgetResponse,
    WidgetUpdate,
)
from app.services.widget import WidgetService

router = APIRouter(prefix="/widgets", tags=["widgets"])


@router.get("/", response_model=list[WidgetResponse])
async def list_widgets(
    project_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WidgetResponse]:
    service = WidgetService(db)
    return await service.list_widgets(user.tenant_id, project_id)


@router.post("/", response_model=WidgetResponse, status_code=201)
async def create_widget(
    body: WidgetCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WidgetResponse:
    service = WidgetService(db)
    result = await service.create_widget(user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.get("/{widget_id}", response_model=WidgetResponse)
async def get_widget(
    widget_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WidgetResponse:
    service = WidgetService(db)
    result = await service.get_widget(widget_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    return result


@router.put("/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    widget_id: UUID,
    body: WidgetUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WidgetResponse:
    service = WidgetService(db)
    result = await service.update_widget(widget_id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    return result


@router.delete("/{widget_id}", status_code=204)
async def delete_widget(
    widget_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    service = WidgetService(db)
    deleted = await service.delete_widget(widget_id, user.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Widget not found")


@router.get("/{widget_id}/embed-code", response_model=EmbedCodeResponse)
async def get_embed_code(
    widget_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EmbedCodeResponse:
    service = WidgetService(db)
    widget = await service.get_widget_model(widget_id, user.tenant_id)
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")

    web_origin = Settings().default_web_origin
    token = widget.embed_token
    theme = widget.theme
    mode = widget.mode

    js_snippet = (
        f'<script src="{web_origin}/widget.js" defer></script>\n'
        f'<div data-aeogeo-widget data-key="{token}" '
        f'data-theme="{theme}" data-mode="{mode}" '
        f'data-max-items="{widget.max_items}"></div>'
    )

    iframe = (
        f'<iframe src="{web_origin}/embed/{token}" '
        f'width="100%" height="500" frameborder="0" '
        f'style="border:none;border-radius:{widget.border_radius}px" '
        f'loading="lazy" title="{widget.name}"></iframe>'
    )

    return EmbedCodeResponse(js_snippet=js_snippet, iframe=iframe)


@router.get("/{widget_id}/analytics", response_model=WidgetAnalyticsResponse)
async def get_widget_analytics(
    widget_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WidgetAnalyticsResponse:
    service = WidgetService(db)
    result = await service.get_widget_analytics(widget_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    return result
