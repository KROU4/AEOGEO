"""Engine service — CRUD for AI engine registry."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.engine import Engine
from app.schemas.engine import EngineCreate, EngineResponse, EngineUpdate


def _engine_response(engine: Engine) -> EngineResponse:
    return EngineResponse(
        id=str(engine.id),
        name=engine.name,
        slug=engine.slug,
        provider=engine.provider,
        is_active=engine.is_active,
        icon_url=engine.icon_url,
    )


class EngineService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_engines(
        self, is_active: bool | None = None
    ) -> list[EngineResponse]:
        query = select(Engine).order_by(Engine.name.asc())

        if is_active is not None:
            query = query.where(Engine.is_active == is_active)

        result = await self.db.execute(query)
        engines = result.scalars().all()

        return [_engine_response(e) for e in engines]

    async def get_engine(self, engine_id: UUID) -> EngineResponse | None:
        result = await self.db.execute(
            select(Engine).where(Engine.id == engine_id)
        )
        engine = result.scalar_one_or_none()
        if engine is None:
            return None

        return _engine_response(engine)

    async def create_engine(self, data: EngineCreate) -> EngineResponse:
        engine = Engine(
            name=data.name,
            slug=data.slug,
            provider=data.provider,
            icon_url=data.icon_url,
        )
        self.db.add(engine)
        await self.db.commit()
        await self.db.refresh(engine)

        return _engine_response(engine)

    async def update_engine(
        self, engine_id: UUID, data: EngineUpdate
    ) -> EngineResponse | None:
        result = await self.db.execute(
            select(Engine).where(Engine.id == engine_id)
        )
        engine = result.scalar_one_or_none()
        if engine is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(engine, key, value)

        await self.db.commit()
        await self.db.refresh(engine)

        return _engine_response(engine)

    async def delete_engine(self, engine_id: UUID) -> bool:
        result = await self.db.execute(
            select(Engine).where(Engine.id == engine_id)
        )
        engine = result.scalar_one_or_none()
        if engine is None:
            return False

        await self.db.delete(engine)
        await self.db.commit()
        return True
