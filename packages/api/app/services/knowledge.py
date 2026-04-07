"""Knowledge service — CRUD for KnowledgeEntry and CustomFile entities."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.models.knowledge import CustomFile, KnowledgeEntry
from app.models.project import Project
from app.schemas.knowledge import (
    CustomFileResponse,
    KnowledgeEntryCreate,
    KnowledgeEntryResponse,
    KnowledgeEntryUpdate,
)
from app.utils.pagination import (
    PaginatedResponse,
    apply_cursor_pagination,
    encode_cursor,
    paginate_results,
)


def _entry_response(entry: KnowledgeEntry) -> KnowledgeEntryResponse:
    return KnowledgeEntryResponse(
        id=entry.id,
        type=entry.type,
        content=entry.content,
        source_url=entry.source_url,
        brand_id=entry.brand_id,
        version=entry.version,
        has_embedding=entry.embedding is not None,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def _file_response(f: CustomFile) -> CustomFileResponse:
    return CustomFileResponse(
        id=f.id,
        filename=f.filename,
        file_type=f.file_type,
        file_size=f.file_size or 0,
        brand_id=f.brand_id,
        created_at=f.created_at,
    )


class KnowledgeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Knowledge entries
    # ------------------------------------------------------------------

    async def create_entry(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: KnowledgeEntryCreate,
    ) -> KnowledgeEntryResponse | None:
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return None

        entry = KnowledgeEntry(
            type=data.type,
            content=data.content,
            source_url=data.source_url,
            brand_id=brand.id,
            version=1,
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)

        return _entry_response(entry)

    async def list_entries(
        self,
        project_id: UUID,
        tenant_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
        entry_type: str | None = None,
    ) -> PaginatedResponse[KnowledgeEntryResponse] | None:
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return None

        query = select(KnowledgeEntry).where(
            KnowledgeEntry.brand_id == brand.id
        )

        if entry_type:
            query = query.where(KnowledgeEntry.type == entry_type)

        query = apply_cursor_pagination(query, KnowledgeEntry, cursor, limit)

        result = await self.db.execute(query)
        rows = list(result.scalars().all())

        items, next_cursor, has_more = paginate_results(rows, limit)
        return PaginatedResponse(
            items=[_entry_response(e) for e in items],
            next_cursor=next_cursor,
            has_more=has_more,
        )

    async def update_entry(
        self,
        entry_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
        data: KnowledgeEntryUpdate,
    ) -> KnowledgeEntryResponse | None:
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return None

        result = await self.db.execute(
            select(KnowledgeEntry).where(
                KnowledgeEntry.id == entry_id,
                KnowledgeEntry.brand_id == brand.id,
            )
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(entry, key, value)

        # Increment version on every update
        entry.version = entry.version + 1
        # Clear embedding since content may have changed
        entry.embedding = None

        await self.db.commit()
        await self.db.refresh(entry)

        return _entry_response(entry)

    async def delete_entry(
        self,
        entry_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return False

        result = await self.db.execute(
            select(KnowledgeEntry).where(
                KnowledgeEntry.id == entry_id,
                KnowledgeEntry.brand_id == brand.id,
            )
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return False

        await self.db.delete(entry)
        await self.db.commit()
        return True

    async def semantic_search(
        self,
        project_id: UUID,
        tenant_id: UUID,
        query_embedding: list[float],
        limit: int = 10,
    ) -> list[KnowledgeEntryResponse] | None:
        """Search knowledge entries by cosine distance using pgvector."""
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return None

        result = await self.db.execute(
            select(KnowledgeEntry)
            .where(
                KnowledgeEntry.brand_id == brand.id,
                KnowledgeEntry.embedding.isnot(None),
            )
            .order_by(KnowledgeEntry.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        entries = result.scalars().all()

        return [_entry_response(e) for e in entries]

    # ------------------------------------------------------------------
    # Custom files
    # ------------------------------------------------------------------

    async def create_file(
        self,
        project_id: UUID,
        tenant_id: UUID,
        filename: str,
        file_type: str,
        file_size: int,
        content_text: str | None = None,
    ) -> CustomFileResponse | None:
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return None

        custom_file = CustomFile(
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            content_text=content_text,
            brand_id=brand.id,
        )
        self.db.add(custom_file)
        await self.db.commit()
        await self.db.refresh(custom_file)

        return _file_response(custom_file)

    async def list_files(
        self,
        project_id: UUID,
        tenant_id: UUID,
    ) -> list[CustomFileResponse] | None:
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return None

        result = await self.db.execute(
            select(CustomFile)
            .where(CustomFile.brand_id == brand.id)
            .order_by(CustomFile.created_at.desc())
        )
        files = result.scalars().all()

        return [_file_response(f) for f in files]

    async def delete_file(
        self,
        file_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return False

        result = await self.db.execute(
            select(CustomFile).where(
                CustomFile.id == file_id, CustomFile.brand_id == brand.id
            )
        )
        custom_file = result.scalar_one_or_none()
        if custom_file is None:
            return False

        await self.db.delete(custom_file)
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_brand(
        self, project_id: UUID, tenant_id: UUID
    ) -> Brand | None:
        """Fetch the brand for a project, verifying tenant ownership."""
        project_result = await self.db.execute(
            select(Project).where(
                Project.id == project_id, Project.tenant_id == tenant_id
            )
        )
        if project_result.scalar_one_or_none() is None:
            return None

        result = await self.db.execute(
            select(Brand).where(Brand.project_id == project_id)
        )
        return result.scalar_one_or_none()
