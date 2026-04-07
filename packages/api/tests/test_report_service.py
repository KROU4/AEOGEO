import asyncio
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.project import Project
from app.models.report import Report
from app.services.report import ReportService


async def _build_report_service_fixture():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    tenant_id = uuid4()
    project_id = uuid4()
    active_report_id = uuid4()
    expired_report_id = uuid4()
    draft_report_id = uuid4()

    async with engine.begin() as conn:
        await conn.exec_driver_sql("CREATE TABLE tenants (id CHAR(32) PRIMARY KEY)")
        await conn.run_sync(Project.__table__.create)
        await conn.run_sync(Report.__table__.create)

        await conn.execute(
            text("INSERT INTO tenants (id) VALUES (:id)"),
            {"id": tenant_id.hex},
        )
        await conn.execute(
            text(
                "INSERT INTO projects (id, name, tenant_id, content_locale) "
                "VALUES (:id, :name, :tenant_id, :content_locale)"
            ),
            {
                "id": project_id.hex,
                "name": "Project",
                "tenant_id": tenant_id.hex,
                "content_locale": "en",
            },
        )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        session.add_all(
            [
                Report(
                    id=active_report_id,
                    title="Visibility Audit",
                    report_type="visibility_audit",
                    project_id=project_id,
                    data_json={"summary": {"score_count": 3}},
                    shareable_token="share-active",
                    expires_at=datetime.utcnow() + timedelta(days=2),
                ),
                Report(
                    id=expired_report_id,
                    title="Expired Audit",
                    report_type="visibility_audit",
                    project_id=project_id,
                    data_json={"summary": {"score_count": 1}},
                    shareable_token="share-expired",
                    expires_at=datetime.utcnow() - timedelta(days=1),
                ),
                Report(
                    id=draft_report_id,
                    title="Competitive Analysis",
                    report_type="competitive_analysis",
                    project_id=project_id,
                    data_json={"brand_mentions": {"name": "AEOGEO"}},
                ),
            ]
        )
        await session.commit()

    return {
        "engine": engine,
        "session_factory": session_factory,
        "tenant_id": tenant_id,
        "active_report_id": active_report_id,
        "expired_report_id": expired_report_id,
        "draft_report_id": draft_report_id,
    }


def test_report_service_resolves_active_and_expired_share_links():
    async def run_test():
        fixture = await _build_report_service_fixture()

        async with fixture["session_factory"]() as session:
            service = ReportService(session)

            active_link = await service.get_share_link(
                fixture["active_report_id"],
                fixture["tenant_id"],
            )
            assert active_link is not None
            assert active_link.url == "/shared/reports/share-active"

            expired_link = await service.get_share_link(
                fixture["expired_report_id"],
                fixture["tenant_id"],
            )
            assert expired_link is None

            shared_report = await service.get_shared_report("share-active")
            assert shared_report is not None
            assert shared_report.title == "Visibility Audit"
            assert shared_report.data == {"summary": {"score_count": 3}}

            expired_report = await service.get_shared_report("share-expired")
            assert expired_report is None

        await fixture["engine"].dispose()

    asyncio.run(run_test())


def test_report_service_creates_share_links_for_unshared_reports():
    async def run_test():
        fixture = await _build_report_service_fixture()

        async with fixture["session_factory"]() as session:
            service = ReportService(session)

            created = await service.create_share_link(
                fixture["draft_report_id"],
                fixture["tenant_id"],
                expires_in_days=7,
            )

            assert created.url.startswith("/shared/reports/")
            assert created.expires_at > datetime.utcnow()

            fetched = await service.get_share_link(
                fixture["draft_report_id"],
                fixture["tenant_id"],
            )
            assert fetched is not None
            assert fetched.url == created.url

        await fixture["engine"].dispose()

    asyncio.run(run_test())
