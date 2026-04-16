from __future__ import annotations

from collections.abc import Generator
import sys
import types
from uuid import UUID, uuid4

import pytest


# Provide a lightweight svix shim for test environments where svix/pydantic
# versions may not align.
svix_module = types.ModuleType("svix")
svix_webhooks_module = types.ModuleType("svix.webhooks")


class _Webhook:
    def __init__(self, *_args, **_kwargs) -> None:
        pass

    def verify(self, *_args, **_kwargs):  # pragma: no cover - shim default
        return {}


class _WebhookVerificationError(Exception):
    pass


svix_webhooks_module.Webhook = _Webhook
svix_webhooks_module.WebhookVerificationError = _WebhookVerificationError
svix_module.webhooks = svix_webhooks_module
sys.modules.setdefault("svix", svix_module)
sys.modules.setdefault("svix.webhooks", svix_webhooks_module)


class FakeRedis:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._counters: dict[str, int] = {}
        self._ttl: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str) -> bool:
        self._store[key] = value
        return True

    async def incr(self, key: str) -> int:
        self._counters[key] = self._counters.get(key, 0) + 1
        return self._counters[key]

    async def expire(self, key: str, seconds: int) -> bool:
        self._ttl[key] = seconds
        return True

    async def eval(self, _script: str, numkeys: int, *keys_and_args: str) -> int:
        """Minimal Lua stand-in for atomic INCR + EXPIRE (see app.utils.rate_limit)."""
        if numkeys != 1:
            raise NotImplementedError("FakeRedis.eval supports numkeys=1 only")
        key = keys_and_args[0]
        window_sec = int(keys_and_args[1])
        count = await self.incr(key)
        if count == 1:
            await self.expire(key, window_sec)
        return count


@pytest.fixture
def fake_redis() -> Generator[FakeRedis, None, None]:
    yield FakeRedis()


@pytest.fixture
def random_user_id() -> UUID:
    return uuid4()


@pytest.fixture
def random_tenant_id() -> UUID:
    return uuid4()
