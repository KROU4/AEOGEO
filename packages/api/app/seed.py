"""Seed script: creates default tenant, admin user, roles, and permissions.

Run migrations first: uv run alembic upgrade head
Then seed:          uv run python -m app.seed
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings
from app.models.engine import Engine
from app.models.role import Permission, Role, RolePermission, UserRole
from app.models.tenant import Tenant
from app.models.tenant_quota import TenantQuota
from app.models.user import User
from app.utils.security import hash_password

# Import all models so Base.metadata knows about every table
import app.models  # noqa: F401

settings = Settings()

PERMISSIONS = [
    ("dashboard", "view"),
    ("projects", "manage"),
    ("content", "create"),
    ("content", "approve"),
    ("reports", "view"),
    ("reports", "create"),
    ("widgets", "manage"),
    ("engines", "manage"),
    ("team", "invite"),
    ("settings", "manage"),
    ("ai_keys", "manage"),
    ("ai_usage", "view"),
    ("ai_usage", "manage"),
    ("admin", "access"),
]

ROLES = [
    ("Admin", True),
    ("Editor", False),
    ("Viewer", False),
]

# (name, slug, provider, model_id, is_active, icon_url)
ENGINES = [
    ("ChatGPT", "chatgpt", "openai", "gpt-4o", True, "https://cdn.aeogeo.com/icons/chatgpt.svg"),
    ("Gemini", "gemini", "google", "gemini-2.5-flash", True, "https://cdn.aeogeo.com/icons/gemini.svg"),
    ("Perplexity", "perplexity", "openrouter", "perplexity/sonar-pro", True, "https://cdn.aeogeo.com/icons/perplexity.svg"),
    ("Google AI Overviews", "ai-overviews", "google", "scraper", True, "https://cdn.aeogeo.com/icons/ai-overviews.svg"),
    ("Claude", "claude", "anthropic", "claude-sonnet-4", True, "https://cdn.aeogeo.com/icons/claude.svg"),
    ("Copilot", "copilot", "openrouter", None, False, "https://cdn.aeogeo.com/icons/copilot.svg"),
]

async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as db:
        # --- Tenant ---
        tenant = await _get_or_create_tenant(db)

        # --- Roles ---
        roles: dict[str, Role] = {}
        for role_name, is_system in ROLES:
            roles[role_name] = await _get_or_create_role(
                db, role_name, tenant.id, is_system
            )

        # --- Permissions ---
        permissions: list[Permission] = []
        for resource, action in PERMISSIONS:
            perm = await _get_or_create_permission(db, resource, action)
            permissions.append(perm)

        # --- Assign all permissions to Admin role ---
        admin_role = roles["Admin"]
        for perm in permissions:
            await _get_or_create_role_permission(db, admin_role.id, perm.id)

        # --- Admin user ---
        user = await _get_or_create_user(db, tenant.id)

        # --- Assign admin user to Admin role ---
        await _get_or_create_user_role(db, user.id, admin_role.id)

        # --- Default tenant quota ---
        await _get_or_create_tenant_quota(db, tenant.id)

        # --- AI Engines ---
        for name, slug, provider, model_id, is_active, icon_url in ENGINES:
            await _get_or_create_engine(
                db, name, slug, provider, is_active, icon_url
            )

        await db.commit()

    await engine.dispose()
    print("Seed completed successfully.")


async def _get_or_create_tenant(db: AsyncSession) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.slug == "aeogeo"))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(name="AEOGEO", slug="aeogeo")
        db.add(tenant)
        await db.flush()
        print("  Created tenant: AEOGEO")
    else:
        print("  Tenant already exists: AEOGEO")
    return tenant


async def _get_or_create_role(
    db: AsyncSession, name: str, tenant_id, is_system: bool
) -> Role:
    result = await db.execute(
        select(Role).where(Role.name == name, Role.tenant_id == tenant_id)
    )
    role = result.scalar_one_or_none()
    if role is None:
        role = Role(name=name, tenant_id=tenant_id, is_system=is_system)
        db.add(role)
        await db.flush()
        print(f"  Created role: {name}")
    else:
        print(f"  Role already exists: {name}")
    return role


async def _get_or_create_permission(
    db: AsyncSession, resource: str, action: str
) -> Permission:
    result = await db.execute(
        select(Permission).where(
            Permission.resource == resource, Permission.action == action
        )
    )
    perm = result.scalar_one_or_none()
    if perm is None:
        perm = Permission(resource=resource, action=action)
        db.add(perm)
        await db.flush()
        print(f"  Created permission: {resource}:{action}")
    else:
        print(f"  Permission already exists: {resource}:{action}")
    return perm


async def _get_or_create_role_permission(db: AsyncSession, role_id, permission_id):
    result = await db.execute(
        select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
    )
    rp = result.scalar_one_or_none()
    if rp is None:
        rp = RolePermission(role_id=role_id, permission_id=permission_id)
        db.add(rp)
        await db.flush()


async def _get_or_create_user(db: AsyncSession, tenant_id) -> User:
    result = await db.execute(
        select(User).where(User.email == "admin@email.com")
    )
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            email="admin@email.com",
            hashed_password=hash_password("password123!"),
            name="Admin",
            tenant_id=tenant_id,
        )
        db.add(user)
        await db.flush()
        print("  Created admin user: admin@email.com")
    else:
        print("  Admin user already exists: admin@email.com")
    return user


async def _get_or_create_user_role(db: AsyncSession, user_id, role_id):
    result = await db.execute(
        select(UserRole).where(
            UserRole.user_id == user_id, UserRole.role_id == role_id
        )
    )
    ur = result.scalar_one_or_none()
    if ur is None:
        ur = UserRole(user_id=user_id, role_id=role_id)
        db.add(ur)
        await db.flush()
        print("  Assigned Admin role to admin user")


async def _get_or_create_tenant_quota(db: AsyncSession, tenant_id) -> TenantQuota:
    result = await db.execute(
        select(TenantQuota).where(TenantQuota.tenant_id == tenant_id)
    )
    quota = result.scalar_one_or_none()
    if quota is None:
        quota = TenantQuota(
            tenant_id=tenant_id,
            monthly_token_budget=10_000_000,
            requests_per_minute=60,
            requests_per_day=10_000,
            warning_threshold_pct=80,
        )
        db.add(quota)
        await db.flush()
        print("  Created default tenant quota")
    else:
        print("  Tenant quota already exists")
    return quota


async def _get_or_create_engine(
    db: AsyncSession,
    name: str,
    slug: str,
    provider: str,
    is_active: bool,
    icon_url: str | None,
) -> Engine:
    result = await db.execute(select(Engine).where(Engine.slug == slug))
    engine = result.scalar_one_or_none()
    if engine is None:
        engine = Engine(
            name=name,
            slug=slug,
            provider=provider,
            is_active=is_active,
            icon_url=icon_url,
        )
        db.add(engine)
        await db.flush()
        print(f"  Created engine: {name} ({provider})")
    else:
        print(f"  Engine already exists: {name} ({provider})")
    return engine


if __name__ == "__main__":
    asyncio.run(seed())
