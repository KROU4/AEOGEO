"""AI provider key service — CRUD and key resolution with fallback logic."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_provider_key import AIProviderKey
from app.utils.encryption import decrypt_value, encrypt_value


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AIKeyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_key(
        self,
        provider: str,
        api_key: str,
        label: str,
        tenant_id: uuid.UUID | None = None,
    ) -> AIProviderKey:
        key = AIProviderKey(
            provider=provider,
            label=label,
            encrypted_api_key=encrypt_value(api_key),
            tenant_id=tenant_id,
            is_active=True,
        )
        self.db.add(key)
        await self.db.flush()
        return key

    async def list_keys(
        self, tenant_id: uuid.UUID | None = None
    ) -> list[AIProviderKey]:
        stmt = (
            select(AIProviderKey)
            .options(selectinload(AIProviderKey.tenant))
            .order_by(AIProviderKey.created_at.desc())
        )
        if tenant_id is not None:
            stmt = stmt.where(
                (AIProviderKey.tenant_id == tenant_id)
                | (AIProviderKey.tenant_id.is_(None))
            )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_key(self, key_id: uuid.UUID) -> AIProviderKey | None:
        result = await self.db.execute(
            select(AIProviderKey)
            .options(selectinload(AIProviderKey.tenant))
            .where(AIProviderKey.id == key_id)
        )
        return result.scalar_one_or_none()

    async def revoke_key(self, key_id: uuid.UUID) -> bool:
        key = await self.get_key(key_id)
        if key is None:
            return False
        key.is_active = False
        await self.db.flush()
        return True

    async def rotate_key(
        self, key_id: uuid.UUID, new_api_key: str
    ) -> AIProviderKey | None:
        key = await self.get_key(key_id)
        if key is None:
            return None
        key.encrypted_api_key = encrypt_value(new_api_key)
        key.last_rotated_at = _utcnow_naive()
        await self.db.flush()
        return key

    async def resolve_key(
        self, provider: str, tenant_id: uuid.UUID
    ) -> str | None:
        """Resolve API key with fallback: tenant key → global key → OpenRouter fallback."""
        # 1. Tenant-specific key for this provider
        key = await self._find_active_key(provider, tenant_id)
        if key:
            return self._decrypt_and_mark(key)

        # 2. Global key for this provider
        key = await self._find_active_key(provider, None)
        if key:
            return self._decrypt_and_mark(key)

        # 3. OpenRouter fallback (if not already requesting openrouter)
        if provider != "openrouter":
            key = await self._find_active_key("openrouter", tenant_id)
            if key:
                return self._decrypt_and_mark(key)

            key = await self._find_active_key("openrouter", None)
            if key:
                return self._decrypt_and_mark(key)

        return None

    async def _find_active_key(
        self, provider: str, tenant_id: uuid.UUID | None
    ) -> AIProviderKey | None:
        stmt = select(AIProviderKey).where(
            AIProviderKey.provider == provider,
            AIProviderKey.is_active.is_(True),
        )
        if tenant_id is not None:
            stmt = stmt.where(AIProviderKey.tenant_id == tenant_id)
        else:
            stmt = stmt.where(AIProviderKey.tenant_id.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def _decrypt_and_mark(self, key: AIProviderKey) -> str:
        key.last_used_at = _utcnow_naive()
        return decrypt_value(key.encrypted_api_key)

    @staticmethod
    def mask_key(encrypted_api_key: str) -> str:
        """Return last 4 characters of the decrypted key for display."""
        try:
            decrypted = decrypt_value(encrypted_api_key)
            return f"...{decrypted[-4:]}" if len(decrypted) >= 4 else "..."
        except Exception:
            return "..."
