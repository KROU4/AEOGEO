from typing import Literal
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WidgetCreate(BaseModel):
    name: str
    project_id: UUID
    theme: str = "dark"
    position: str = "bottom-right"
    mode: str = "faq"
    max_items: int = 5
    border_radius: int = 8
    font_family: str = "Inter"
    json_ld_enabled: bool = False


class WidgetUpdate(BaseModel):
    name: str | None = None
    theme: str | None = None
    position: str | None = None
    mode: str | None = None
    max_items: int | None = None
    border_radius: int | None = None
    font_family: str | None = None
    is_active: bool | None = None
    json_ld_enabled: bool | None = None


class WidgetResponse(BaseModel):
    id: UUID
    name: str
    project_id: UUID
    theme: str
    position: str
    mode: str
    max_items: int
    border_radius: int
    font_family: str
    embed_token: str
    is_active: bool
    json_ld_enabled: bool
    created_at: datetime
    updated_at: datetime | None = None


class EmbedCodeResponse(BaseModel):
    js_snippet: str
    iframe: str


class WidgetContentItem(BaseModel):
    id: UUID
    title: str
    body: str
    content_type: str
    published_at: datetime | None = None


class WidgetContentResponse(BaseModel):
    items: list[WidgetContentItem]
    widget: dict
    json_ld: str | None = None


class WidgetEventCreate(BaseModel):
    event_type: Literal["impression", "item_interaction"]
    session_id: str | None = None
    content_id: UUID | None = None


class WidgetAnalyticsItem(BaseModel):
    content_id: UUID
    title: str
    interaction_count: int


class WidgetAnalyticsResponse(BaseModel):
    impressions: int
    item_interactions: int
    top_content: list[WidgetAnalyticsItem]
