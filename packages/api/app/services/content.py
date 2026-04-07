from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.content import Content
from app.models.project import Project
from app.schemas.content import ContentCreate, ContentResponse, ContentUpdate
from app.utils.pagination import (
    PaginatedResponse,
    apply_cursor_pagination,
    paginate_results,
    encode_cursor,
)

VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"review", "archived"},
    "review": {"published", "draft", "archived"},
    "published": {"archived"},
    "archived": set(),
}


def _to_response(content: Content) -> ContentResponse:
    author_name = content.author.name if content.author else ""
    return ContentResponse(
        id=content.id,
        title=content.title,
        body=content.body,
        content_type=content.content_type,
        status=content.status,
        author_name=author_name,
        project_id=content.project_id,
        template_id=content.template_id,
        reviewer_notes=content.reviewer_notes,
        json_ld=content.json_ld,
        created_at=content.created_at,
        updated_at=content.updated_at,
        published_at=content.published_at,
    )


class ContentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_content(
        self,
        tenant_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
        status: str | None = None,
        project_id: UUID | None = None,
    ) -> PaginatedResponse[ContentResponse]:
        query = (
            select(Content)
            .join(Project, Content.project_id == Project.id)
            .where(Project.tenant_id == tenant_id)
            .options(selectinload(Content.author))
        )

        if status:
            query = query.where(Content.status == status)
        if project_id:
            query = query.where(Content.project_id == project_id)

        query = apply_cursor_pagination(query, Content, cursor, limit)

        result = await self.db.execute(query)
        rows = list(result.scalars().all())

        items, next_cursor, has_more = paginate_results(rows, limit)
        return PaginatedResponse(
            items=[_to_response(c) for c in items],
            next_cursor=next_cursor,
            has_more=has_more,
        )

    async def create_content(
        self,
        author_id: UUID,
        tenant_id: UUID,
        data: ContentCreate,
    ) -> ContentResponse | None:
        # Verify project belongs to tenant
        result = await self.db.execute(
            select(Project).where(
                Project.id == data.project_id, Project.tenant_id == tenant_id
            )
        )
        if result.scalar_one_or_none() is None:
            return None

        content = Content(
            title=data.title,
            body=data.body,
            content_type=data.content_type,
            project_id=data.project_id,
            author_id=author_id,
            status="draft",
        )
        self.db.add(content)
        await self.db.commit()
        await self.db.refresh(content, attribute_names=["author"])

        return _to_response(content)

    async def get_content(
        self, content_id: UUID, tenant_id: UUID
    ) -> Content | None:
        result = await self.db.execute(
            select(Content)
            .join(Project, Content.project_id == Project.id)
            .where(Content.id == content_id, Project.tenant_id == tenant_id)
            .options(selectinload(Content.author))
        )
        return result.scalar_one_or_none()

    async def update_content(
        self,
        content_id: UUID,
        tenant_id: UUID,
        data: ContentUpdate,
    ) -> ContentResponse | None:
        content = await self.get_content(content_id, tenant_id)
        if content is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(content, key, value)

        await self.db.commit()
        await self.db.refresh(content, attribute_names=["author"])

        return _to_response(content)

    async def transition_status(
        self,
        content_id: UUID,
        tenant_id: UUID,
        new_status: str,
    ) -> ContentResponse | None:
        content = await self.get_content(content_id, tenant_id)
        if content is None:
            return None

        allowed = VALID_TRANSITIONS.get(content.status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Cannot transition from '{content.status}' to '{new_status}'"
            )

        content.status = new_status
        if new_status == "published":
            content.published_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(content)

        # Re-fetch with author eagerly loaded
        refreshed = await self.get_content(content.id, tenant_id)
        return _to_response(refreshed)  # type: ignore[arg-type]
