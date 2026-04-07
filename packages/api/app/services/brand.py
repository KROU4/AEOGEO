"""Brand service — CRUD for Brand, Product, and Competitor entities."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.brand import Brand
from app.models.competitor import Competitor
from app.models.product import Product
from app.models.project import Project
from app.schemas.brand import BrandCreate, BrandResponse, BrandUpdate
from app.schemas.competitor import (
    CompetitorCreate,
    CompetitorResponse,
    CompetitorUpdate,
)
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate


def _brand_response(brand: Brand) -> BrandResponse:
    return BrandResponse(
        id=brand.id,
        name=brand.name,
        description=brand.description,
        positioning=brand.positioning,
        website=brand.website,
        allowed_phrases=brand.allowed_phrases,
        forbidden_phrases=brand.forbidden_phrases,
        voice_guidelines=brand.voice_guidelines,
        project_id=brand.project_id,
        created_at=brand.created_at,
        updated_at=brand.updated_at,
    )


def _product_response(product: Product) -> ProductResponse:
    return ProductResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        features=product.features,
        pricing=product.pricing,
        category=product.category,
        brand_id=product.brand_id,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


def _competitor_response(competitor: Competitor) -> CompetitorResponse:
    return CompetitorResponse(
        id=competitor.id,
        name=competitor.name,
        website=competitor.website,
        positioning=competitor.positioning,
        notes=competitor.notes,
        brand_id=competitor.brand_id,
        created_at=competitor.created_at,
        updated_at=competitor.updated_at,
    )


class BrandService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Brand
    # ------------------------------------------------------------------

    async def get_or_create_brand(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: BrandCreate,
    ) -> BrandResponse:
        """Return existing brand for the project, or create a new one."""
        # Verify project belongs to tenant
        project = await self._verify_project(project_id, tenant_id)
        if project is None:
            raise ValueError("Project not found")

        result = await self.db.execute(
            select(Brand)
            .where(Brand.project_id == project_id)
            .options(selectinload(Brand.products), selectinload(Brand.competitors))
        )
        brand = result.scalar_one_or_none()

        if brand is not None:
            return _brand_response(brand)

        brand = Brand(
            name=data.name,
            description=data.description,
            positioning=data.positioning,
            website=data.website,
            allowed_phrases=data.allowed_phrases,
            forbidden_phrases=data.forbidden_phrases,
            voice_guidelines=data.voice_guidelines,
            project_id=project_id,
        )
        self.db.add(brand)
        await self.db.commit()
        await self.db.refresh(brand)

        return _brand_response(brand)

    async def get_brand(
        self,
        project_id: UUID,
        tenant_id: UUID,
    ) -> BrandResponse | None:
        """Fetch brand for a project, eager-loading products and competitors."""
        project = await self._verify_project(project_id, tenant_id)
        if project is None:
            return None

        result = await self.db.execute(
            select(Brand)
            .where(Brand.project_id == project_id)
            .options(selectinload(Brand.products), selectinload(Brand.competitors))
        )
        brand = result.scalar_one_or_none()
        if brand is None:
            return None

        return _brand_response(brand)

    async def update_brand(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: BrandUpdate,
    ) -> BrandResponse | None:
        project = await self._verify_project(project_id, tenant_id)
        if project is None:
            return None

        result = await self.db.execute(
            select(Brand).where(Brand.project_id == project_id)
        )
        brand = result.scalar_one_or_none()
        if brand is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(brand, key, value)

        await self.db.commit()
        await self.db.refresh(brand)

        return _brand_response(brand)

    # ------------------------------------------------------------------
    # Products
    # ------------------------------------------------------------------

    async def add_product(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: ProductCreate,
    ) -> ProductResponse | None:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return None

        product = Product(
            name=data.name,
            description=data.description,
            features=data.features,
            pricing=data.pricing,
            category=data.category,
            brand_id=brand.id,
        )
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)

        return _product_response(product)

    async def update_product(
        self,
        product_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
        data: ProductUpdate,
    ) -> ProductResponse | None:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return None

        result = await self.db.execute(
            select(Product).where(
                Product.id == product_id, Product.brand_id == brand.id
            )
        )
        product = result.scalar_one_or_none()
        if product is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(product, key, value)

        await self.db.commit()
        await self.db.refresh(product)

        return _product_response(product)

    async def delete_product(
        self,
        product_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return False

        result = await self.db.execute(
            select(Product).where(
                Product.id == product_id, Product.brand_id == brand.id
            )
        )
        product = result.scalar_one_or_none()
        if product is None:
            return False

        await self.db.delete(product)
        await self.db.commit()
        return True

    async def list_products(
        self,
        project_id: UUID,
        tenant_id: UUID,
    ) -> list[ProductResponse] | None:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return None

        result = await self.db.execute(
            select(Product)
            .where(Product.brand_id == brand.id)
            .order_by(Product.created_at.desc())
        )
        products = result.scalars().all()

        return [_product_response(p) for p in products]

    # ------------------------------------------------------------------
    # Competitors
    # ------------------------------------------------------------------

    async def add_competitor(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: CompetitorCreate,
    ) -> CompetitorResponse | None:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return None

        competitor = Competitor(
            name=data.name,
            website=data.website,
            positioning=data.positioning,
            notes=data.notes,
            brand_id=brand.id,
        )
        self.db.add(competitor)
        await self.db.commit()
        await self.db.refresh(competitor)

        return _competitor_response(competitor)

    async def update_competitor(
        self,
        competitor_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
        data: CompetitorUpdate,
    ) -> CompetitorResponse | None:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return None

        result = await self.db.execute(
            select(Competitor).where(
                Competitor.id == competitor_id, Competitor.brand_id == brand.id
            )
        )
        competitor = result.scalar_one_or_none()
        if competitor is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(competitor, key, value)

        await self.db.commit()
        await self.db.refresh(competitor)

        return _competitor_response(competitor)

    async def delete_competitor(
        self,
        competitor_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return False

        result = await self.db.execute(
            select(Competitor).where(
                Competitor.id == competitor_id, Competitor.brand_id == brand.id
            )
        )
        competitor = result.scalar_one_or_none()
        if competitor is None:
            return False

        await self.db.delete(competitor)
        await self.db.commit()
        return True

    async def list_competitors(
        self,
        project_id: UUID,
        tenant_id: UUID,
    ) -> list[CompetitorResponse] | None:
        brand = await self._get_brand_model(project_id, tenant_id)
        if brand is None:
            return None

        result = await self.db.execute(
            select(Competitor)
            .where(Competitor.brand_id == brand.id)
            .order_by(Competitor.created_at.desc())
        )
        competitors = result.scalars().all()

        return [_competitor_response(c) for c in competitors]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _verify_project(
        self, project_id: UUID, tenant_id: UUID
    ) -> Project | None:
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id, Project.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def _get_brand_model(
        self, project_id: UUID, tenant_id: UUID
    ) -> Brand | None:
        project = await self._verify_project(project_id, tenant_id)
        if project is None:
            return None

        result = await self.db.execute(
            select(Brand).where(Brand.project_id == project_id)
        )
        return result.scalar_one_or_none()
