"""Widget service — CRUD and public content delivery."""

import json
import secrets
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.project import Project
from app.models.widget import Widget
from app.models.widget_event import WidgetEvent
from app.schemas.widget import (
    WidgetAnalyticsItem,
    WidgetAnalyticsResponse,
    WidgetContentItem,
    WidgetContentResponse,
    WidgetCreate,
    WidgetEventCreate,
    WidgetResponse,
    WidgetUpdate,
)


def _generate_embed_token() -> str:
    """Generate a unique embed token with a 'wk_' prefix."""
    return "wk_" + secrets.token_urlsafe(24)


# Mapping from widget mode to content_type values
MODE_TO_CONTENT_TYPES: dict[str, list[str]] = {
    "faq": ["faq"],
    "blog_feed": ["blog"],
    "ai_consultant": ["faq", "blog", "comparison", "buyer_guide"],
}


def _to_response(widget: Widget) -> WidgetResponse:
    return WidgetResponse(
        id=widget.id,
        name=widget.name,
        project_id=widget.project_id,
        theme=widget.theme,
        position=widget.position,
        mode=widget.mode,
        max_items=widget.max_items,
        border_radius=widget.border_radius,
        font_family=widget.font_family,
        embed_token=widget.embed_token,
        is_active=widget.is_active,
        json_ld_enabled=widget.json_ld_enabled,
        created_at=widget.created_at,
        updated_at=widget.updated_at,
    )


def _generate_faq_json_ld(items: list[WidgetContentItem]) -> str:
    """Generate Schema.org FAQPage JSON-LD from FAQ content items."""
    entries = []
    for item in items:
        entries.append(
            {
                "@type": "Question",
                "name": item.title,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.body,
                },
            }
        )
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": entries,
    }
    return json.dumps(schema, ensure_ascii=False)


def _generate_blog_json_ld(items: list[WidgetContentItem]) -> str:
    """Generate Schema.org Blog JSON-LD from blog content items."""
    posts = []
    for item in items:
        post: dict = {
            "@type": "BlogPosting",
            "headline": item.title,
            "articleBody": item.body,
        }
        if item.published_at:
            post["datePublished"] = item.published_at.isoformat()
        posts.append(post)
    schema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "blogPost": posts,
    }
    return json.dumps(schema, ensure_ascii=False)


class WidgetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_widget(
        self, tenant_id: UUID, data: WidgetCreate
    ) -> WidgetResponse | None:
        # Verify project belongs to the tenant
        result = await self.db.execute(
            select(Project).where(
                Project.id == data.project_id, Project.tenant_id == tenant_id
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            return None

        widget = Widget(
            name=data.name,
            project_id=data.project_id,
            theme=data.theme,
            position=data.position,
            mode=data.mode,
            max_items=data.max_items,
            border_radius=data.border_radius,
            font_family=data.font_family,
            embed_token=_generate_embed_token(),
            is_active=True,
            json_ld_enabled=data.json_ld_enabled,
        )
        self.db.add(widget)
        await self.db.commit()
        await self.db.refresh(widget)
        return _to_response(widget)

    async def list_widgets(
        self, tenant_id: UUID, project_id: UUID | None = None
    ) -> list[WidgetResponse]:
        query = (
            select(Widget)
            .join(Project, Widget.project_id == Project.id)
            .where(Project.tenant_id == tenant_id)
            .order_by(Widget.created_at.desc())
        )
        if project_id is not None:
            query = query.where(Widget.project_id == project_id)

        result = await self.db.execute(query)
        widgets = result.scalars().all()
        return [_to_response(w) for w in widgets]

    async def get_widget(
        self, widget_id: UUID, tenant_id: UUID
    ) -> WidgetResponse | None:
        result = await self.db.execute(
            select(Widget)
            .join(Project, Widget.project_id == Project.id)
            .where(Widget.id == widget_id, Project.tenant_id == tenant_id)
        )
        widget = result.scalar_one_or_none()
        if widget is None:
            return None
        return _to_response(widget)

    async def get_widget_model(
        self, widget_id: UUID, tenant_id: UUID
    ) -> Widget | None:
        """Return the raw Widget ORM object (for embed code generation, etc.)."""
        result = await self.db.execute(
            select(Widget)
            .join(Project, Widget.project_id == Project.id)
            .where(Widget.id == widget_id, Project.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def update_widget(
        self, widget_id: UUID, tenant_id: UUID, data: WidgetUpdate
    ) -> WidgetResponse | None:
        widget = await self.get_widget_model(widget_id, tenant_id)
        if widget is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(widget, key, value)

        await self.db.commit()
        await self.db.refresh(widget)
        return _to_response(widget)

    async def delete_widget(
        self, widget_id: UUID, tenant_id: UUID
    ) -> bool:
        widget = await self.get_widget_model(widget_id, tenant_id)
        if widget is None:
            return False

        await self.db.delete(widget)
        await self.db.commit()
        return True

    async def get_widget_by_token(self, embed_token: str) -> Widget | None:
        """Look up a widget by its public embed token."""
        result = await self.db.execute(
            select(Widget)
            .options(selectinload(Widget.project))
            .where(Widget.embed_token == embed_token, Widget.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def get_widget_content(
        self, embed_token: str
    ) -> WidgetContentResponse | None:
        """Load published content for a widget, filtered by mode.

        This is the public-facing content delivery method.
        """
        widget = await self.get_widget_by_token(embed_token)
        if widget is None:
            return None

        # Determine which content types to include based on widget mode
        content_types = MODE_TO_CONTENT_TYPES.get(widget.mode, ["faq", "blog"])

        query = (
            select(Content)
            .where(
                Content.project_id == widget.project_id,
                Content.status == "published",
                Content.content_type.in_(content_types),
            )
            .order_by(Content.published_at.desc().nullslast())
            .limit(widget.max_items)
        )

        result = await self.db.execute(query)
        content_rows = result.scalars().all()

        items = [
            WidgetContentItem(
                id=c.id,
                title=c.title,
                body=c.body,
                content_type=c.content_type,
                published_at=c.published_at,
            )
            for c in content_rows
        ]

        # Generate JSON-LD if enabled
        json_ld: str | None = None
        if widget.json_ld_enabled and items:
            if widget.mode == "faq":
                json_ld = _generate_faq_json_ld(items)
            elif widget.mode == "blog_feed":
                json_ld = _generate_blog_json_ld(items)
            else:
                # Default to FAQ-style for other modes
                json_ld = _generate_faq_json_ld(items)

        widget_config = {
            "theme": widget.theme,
            "position": widget.position,
            "mode": widget.mode,
            "max_items": widget.max_items,
            "border_radius": widget.border_radius,
            "font_family": widget.font_family,
        }

        return WidgetContentResponse(
            items=items,
            widget=widget_config,
            json_ld=json_ld,
        )

    async def track_widget_event(
        self,
        embed_token: str,
        data: WidgetEventCreate,
    ) -> bool:
        widget = await self.get_widget_by_token(embed_token)
        if widget is None:
            return False

        if data.content_id is not None:
            result = await self.db.execute(
                select(Content.id).where(
                    Content.id == data.content_id,
                    Content.project_id == widget.project_id,
                )
            )
            if result.scalar_one_or_none() is None:
                raise ValueError("Content not found for widget project")

        event = WidgetEvent(
            widget_id=widget.id,
            content_id=data.content_id,
            event_type=data.event_type,
            session_id=data.session_id,
        )
        self.db.add(event)
        await self.db.commit()
        return True

    async def get_widget_analytics(
        self,
        widget_id: UUID,
        tenant_id: UUID,
    ) -> WidgetAnalyticsResponse | None:
        widget = await self.get_widget_model(widget_id, tenant_id)
        if widget is None:
            return None

        totals_result = await self.db.execute(
            select(
                func.count()
                .filter(WidgetEvent.event_type == "impression")
                .label("impressions"),
                func.count()
                .filter(WidgetEvent.event_type == "item_interaction")
                .label("item_interactions"),
            )
            .select_from(WidgetEvent)
            .where(WidgetEvent.widget_id == widget.id)
        )
        totals = totals_result.one()

        top_content_result = await self.db.execute(
            select(
                Content.id,
                Content.title,
                func.count().label("interaction_count"),
            )
            .select_from(WidgetEvent)
            .join(Content, Content.id == WidgetEvent.content_id)
            .where(
                WidgetEvent.widget_id == widget.id,
                WidgetEvent.event_type == "item_interaction",
                WidgetEvent.content_id.is_not(None),
            )
            .group_by(Content.id, Content.title)
            .order_by(func.count().desc(), Content.title.asc())
            .limit(5)
        )

        return WidgetAnalyticsResponse(
            impressions=totals.impressions or 0,
            item_interactions=totals.item_interactions or 0,
            top_content=[
                WidgetAnalyticsItem(
                    content_id=row.id,
                    title=row.title,
                    interaction_count=row.interaction_count,
                )
                for row in top_content_result.all()
            ],
        )
