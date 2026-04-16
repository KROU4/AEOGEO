import asyncio
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.routers import auth


class DummyRequest:
    def __init__(self, body: bytes, headers: dict[str, str]):
        self._body = body
        self.headers = headers

    async def body(self) -> bytes:
        return self._body


def test_clerk_webhook_requires_secret():
    request = DummyRequest(body=b"{}", headers={})
    settings = SimpleNamespace(clerk_webhook_secret="")

    async def run_test():
        try:
            await auth.clerk_webhook(request=request, db=None, settings=settings)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 503
            assert exc.detail["code"] == "auth.webhook_not_configured"

    asyncio.run(run_test())


def test_clerk_webhook_rejects_invalid_signature(monkeypatch):
    class BrokenWebhook:
        def __init__(self, *_args, **_kwargs):
            pass

        def verify(self, *_args, **_kwargs):
            raise auth.WebhookVerificationError("bad signature")

    monkeypatch.setattr(auth, "Webhook", BrokenWebhook)

    request = DummyRequest(
        body=b"{}",
        headers={
            "svix-id": "id",
            "svix-timestamp": "timestamp",
            "svix-signature": "signature",
        },
    )
    settings = SimpleNamespace(clerk_webhook_secret="whsec_test")

    async def run_test():
        try:
            await auth.clerk_webhook(request=request, db=None, settings=settings)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert exc.detail["code"] == "auth.invalid_webhook_signature"

    asyncio.run(run_test())


def test_clerk_webhook_accepts_user_created(monkeypatch):
    user_id = uuid4()

    class WorkingWebhook:
        def __init__(self, *_args, **_kwargs):
            pass

        def verify(self, *_args, **_kwargs):
            return {
                "type": "user.created",
                "data": {
                    "id": "user_123",
                    "primary_email_address_id": "email_primary",
                    "email_addresses": [
                        {"id": "email_primary", "email_address": "new@example.com"}
                    ],
                    "first_name": "New",
                    "last_name": "User",
                },
            }

    class FakeAuthService:
        def __init__(self, *_args, **_kwargs):
            pass

        async def provision_from_clerk_user_created(self, **_kwargs):
            return SimpleNamespace(id=user_id)

    monkeypatch.setattr(auth, "Webhook", WorkingWebhook)
    monkeypatch.setattr(auth, "AuthService", FakeAuthService)

    request = DummyRequest(
        body=b"{}",
        headers={
            "svix-id": "id",
            "svix-timestamp": "timestamp",
            "svix-signature": "signature",
        },
    )
    settings = SimpleNamespace(clerk_webhook_secret="whsec_test")

    async def run_test():
        response = await auth.clerk_webhook(request=request, db=None, settings=settings)
        assert response["ok"] is True
        assert response["user_id"] == str(user_id)

    asyncio.run(run_test())
