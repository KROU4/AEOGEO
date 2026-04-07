import asyncio
import json
from types import SimpleNamespace
from uuid import uuid4

from app.routers import public, widgets
from app.schemas.widget import (
    WidgetAnalyticsItem,
    WidgetAnalyticsResponse,
    WidgetContentItem,
    WidgetContentResponse,
    WidgetEventCreate,
)


def test_get_embed_code_returns_token_based_web_host_urls(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://sand-source.com")

    class DummyWidgetService:
        def __init__(self, db):
            self.db = db

        async def get_widget_model(self, widget_id, tenant_id):
            return SimpleNamespace(
                id=widget_id,
                name="FAQ Widget",
                embed_token="wk_embed_123",
                theme="dark",
                mode="faq",
                max_items=5,
                border_radius=12,
            )

    monkeypatch.setattr(widgets, "WidgetService", DummyWidgetService)

    async def run_test():
        return await widgets.get_embed_code(
            widget_id=uuid4(),
            db=None,
            user=SimpleNamespace(tenant_id=uuid4()),
        )

    result = asyncio.run(run_test())

    assert 'https://sand-source.com/widget.js' in result.js_snippet
    assert 'data-key="wk_embed_123"' in result.js_snippet
    assert 'https://sand-source.com/embed/wk_embed_123' in result.iframe


def test_public_widget_content_route_returns_content_with_headers(monkeypatch):
    class FakePipeline:
        async def execute(self):
            return [1, True]

        def incr(self, key):
            return self

        def expire(self, key, seconds):
            return self

    class FakeRedis:
        async def get(self, key):
            return None

        def pipeline(self):
            return FakePipeline()

    class DummyWidgetService:
        def __init__(self, db):
            self.db = db

        async def get_widget_content(self, embed_token):
            return WidgetContentResponse(
                items=[
                    WidgetContentItem(
                        id=uuid4(),
                        title="What does AEOGEO do?",
                        body="It measures AI visibility.",
                        content_type="faq",
                        published_at=None,
                    )
                ],
                widget={"theme": "dark", "mode": "faq"},
                json_ld=None,
            )

    monkeypatch.setattr(public, "WidgetService", DummyWidgetService)

    async def run_test():
        return await public.get_widget_content(
            embed_token="wk_embed_123",
            db=None,
            redis=FakeRedis(),
        )

    response = asyncio.run(run_test())
    payload = json.loads(response.body)

    assert response.headers["Access-Control-Allow-Origin"] == "*"
    assert response.headers["X-RateLimit-Limit"] == "60"
    assert response.headers["X-RateLimit-Remaining"] == "59"
    assert payload["widget"]["mode"] == "faq"
    assert payload["items"][0]["title"] == "What does AEOGEO do?"


def test_public_widget_event_route_accepts_events_with_headers(monkeypatch):
    class FakePipeline:
        async def execute(self):
            return [1, True]

        def incr(self, key):
            return self

        def expire(self, key, seconds):
            return self

    class FakeRedis:
        async def get(self, key):
            return None

        def pipeline(self):
            return FakePipeline()

    class DummyWidgetService:
        def __init__(self, db):
            self.db = db

        async def track_widget_event(self, embed_token, body):
            assert embed_token == "wk_embed_123"
            assert body.event_type == "item_interaction"
            return True

    monkeypatch.setattr(public, "WidgetService", DummyWidgetService)

    async def run_test():
        return await public.track_widget_event(
            embed_token="wk_embed_123",
            body=WidgetEventCreate(
                event_type="item_interaction",
                session_id="session-1",
            ),
            db=None,
            redis=FakeRedis(),
        )

    response = asyncio.run(run_test())
    payload = json.loads(response.body)

    assert response.status_code == 202
    assert response.headers["Access-Control-Allow-Origin"] == "*"
    assert response.headers["X-RateLimit-Remaining"] == "59"
    assert payload["status"] == "accepted"


def test_widget_analytics_route_returns_service_summary(monkeypatch):
    class DummyWidgetService:
        def __init__(self, db):
            self.db = db

        async def get_widget_analytics(self, widget_id, tenant_id):
            return WidgetAnalyticsResponse(
                impressions=12,
                item_interactions=4,
                top_content=[
                    WidgetAnalyticsItem(
                        content_id=uuid4(),
                        title="Top FAQ",
                        interaction_count=3,
                    )
                ],
            )

    monkeypatch.setattr(widgets, "WidgetService", DummyWidgetService)

    async def run_test():
        return await widgets.get_widget_analytics(
            widget_id=uuid4(),
            db=None,
            user=SimpleNamespace(tenant_id=uuid4()),
        )

    result = asyncio.run(run_test())

    assert result.impressions == 12
    assert result.item_interactions == 4
    assert result.top_content[0].title == "Top FAQ"
