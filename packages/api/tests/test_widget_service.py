import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.content import Content
from app.models.project import Project
from app.models.widget import Widget
from app.models.widget_event import WidgetEvent
from app.schemas.widget import WidgetEventCreate
from app.services.widget import WidgetService


async def _build_widget_service_fixture():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    tenant_id = uuid4()
    user_id = uuid4()
    project_id = uuid4()
    widget_id = uuid4()
    content_id = uuid4()
    second_content_id = uuid4()

    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE TABLE tenants (id CHAR(32) PRIMARY KEY)")
        await conn.exec_driver_sql("CREATE TABLE users (id CHAR(32) PRIMARY KEY)")
        await conn.exec_driver_sql(
            "CREATE TABLE content_templates (id CHAR(32) PRIMARY KEY)"
        )
        await conn.run_sync(Project.__table__.create)
        await conn.run_sync(Widget.__table__.create)
        await conn.run_sync(Content.__table__.create)
        await conn.run_sync(WidgetEvent.__table__.create)

        await conn.execute(
            text("INSERT INTO tenants (id) VALUES (:id)"),
            {"id": tenant_id.hex},
        )
        await conn.execute(
            text("INSERT INTO users (id) VALUES (:id)"),
            {"id": user_id.hex},
        )
        await conn.execute(
            text(
                "INSERT INTO projects (id, name, tenant_id) "
                "VALUES (:id, :name, :tenant_id)"
            ),
            {
                "id": project_id.hex,
                "name": "Project",
                "tenant_id": tenant_id.hex,
            },
        )
        await conn.execute(
            text(
                "INSERT INTO widgets "
                "("
                "id, name, project_id, theme, position, mode, max_items, "
                "border_radius, font_family, embed_token, is_active, json_ld_enabled"
                ") "
                "VALUES "
                "("
                ":id, :name, :project_id, :theme, :position, :mode, :max_items, "
                ":border_radius, :font_family, :embed_token, :is_active, :json_ld_enabled"
                ")"
            ),
            {
                "id": widget_id.hex,
                "name": "Widget",
                "project_id": project_id.hex,
                "theme": "dark",
                "position": "bottom-right",
                "mode": "faq",
                "max_items": 5,
                "border_radius": 8,
                "font_family": "Inter",
                "embed_token": "wk_test_widget",
                "is_active": 1,
                "json_ld_enabled": 0,
            },
        )

        for current_content_id, title in (
            (content_id, "Primary FAQ"),
            (second_content_id, "Secondary FAQ"),
        ):
            await conn.execute(
                text(
                    "INSERT INTO content "
                    "("
                    "id, title, body, content_type, status, project_id, author_id"
                    ") "
                    "VALUES "
                    "("
                    ":id, :title, :body, :content_type, :status, :project_id, :author_id"
                    ")"
                ),
                {
                    "id": current_content_id.hex,
                    "title": title,
                    "body": f"Body for {title}",
                    "content_type": "faq",
                    "status": "published",
                    "project_id": project_id.hex,
                    "author_id": user_id.hex,
                },
            )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return {
        "engine": engine,
        "session_factory": session_factory,
        "tenant_id": tenant_id,
        "widget_id": widget_id,
        "content_id": content_id,
        "second_content_id": second_content_id,
    }


def test_widget_service_tracks_public_events_and_aggregates_top_content():
    async def run_test():
        fixture = await _build_widget_service_fixture()

        async with fixture["session_factory"]() as session:
            service = WidgetService(session)

            assert await service.track_widget_event(
                "wk_test_widget",
                WidgetEventCreate(
                    event_type="impression",
                    session_id="session-1",
                ),
            )
            assert await service.track_widget_event(
                "wk_test_widget",
                WidgetEventCreate(
                    event_type="item_interaction",
                    session_id="session-1",
                    content_id=fixture["content_id"],
                ),
            )
            assert await service.track_widget_event(
                "wk_test_widget",
                WidgetEventCreate(
                    event_type="item_interaction",
                    session_id="session-2",
                    content_id=fixture["content_id"],
                ),
            )
            assert await service.track_widget_event(
                "wk_test_widget",
                WidgetEventCreate(
                    event_type="item_interaction",
                    session_id="session-3",
                    content_id=fixture["second_content_id"],
                ),
            )

            analytics = await service.get_widget_analytics(
                fixture["widget_id"],
                fixture["tenant_id"],
            )

            assert analytics is not None
            assert analytics.impressions == 1
            assert analytics.item_interactions == 3
            assert [item.title for item in analytics.top_content] == [
                "Primary FAQ",
                "Secondary FAQ",
            ]
            assert [item.interaction_count for item in analytics.top_content] == [2, 1]

        await fixture["engine"].dispose()

    asyncio.run(run_test())


def test_widget_service_rejects_content_outside_widget_project():
    async def run_test():
        fixture = await _build_widget_service_fixture()

        async with fixture["session_factory"]() as session:
            service = WidgetService(session)

            with pytest.raises(ValueError, match="Content not found"):
                await service.track_widget_event(
                    "wk_test_widget",
                    WidgetEventCreate(
                        event_type="item_interaction",
                        session_id="session-1",
                        content_id=uuid4(),
                    ),
                )

        await fixture["engine"].dispose()

    asyncio.run(run_test())
