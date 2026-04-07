"""Analytics integration service — CRUD for integrations + traffic data queries."""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_integration import AnalyticsIntegration
from app.models.traffic_snapshot import TrafficSnapshot
from app.schemas.analytics import TrafficDataPoint, TrafficSummary
from app.utils.encryption import decrypt_value, encrypt_value


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # --- Integration CRUD ---

    async def create_integration(
        self,
        project_id: uuid.UUID,
        provider: str,
        external_id: str,
        credentials: str,
    ) -> AnalyticsIntegration:
        integration = AnalyticsIntegration(
            project_id=project_id,
            provider=provider,
            external_id=external_id,
            encrypted_credentials=encrypt_value(credentials),
            is_active=True,
        )
        self.db.add(integration)
        await self.db.flush()
        return integration

    async def list_integrations(
        self, project_id: uuid.UUID
    ) -> list[AnalyticsIntegration]:
        stmt = (
            select(AnalyticsIntegration)
            .where(AnalyticsIntegration.project_id == project_id)
            .order_by(AnalyticsIntegration.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_integration(
        self, integration_id: uuid.UUID
    ) -> AnalyticsIntegration | None:
        result = await self.db.execute(
            select(AnalyticsIntegration).where(
                AnalyticsIntegration.id == integration_id
            )
        )
        return result.scalar_one_or_none()

    async def update_integration(
        self,
        integration_id: uuid.UUID,
        *,
        external_id: str | None = None,
        credentials: str | None = None,
        is_active: bool | None = None,
    ) -> AnalyticsIntegration | None:
        integration = await self.get_integration(integration_id)
        if integration is None:
            return None
        if external_id is not None:
            integration.external_id = external_id
        if credentials is not None:
            integration.encrypted_credentials = encrypt_value(credentials)
        if is_active is not None:
            integration.is_active = is_active
        await self.db.flush()
        return integration

    async def delete_integration(self, integration_id: uuid.UUID) -> bool:
        integration = await self.get_integration(integration_id)
        if integration is None:
            return False
        await self.db.delete(integration)
        await self.db.flush()
        return True

    def decrypt_credentials(self, integration: AnalyticsIntegration) -> str:
        return decrypt_value(integration.encrypted_credentials)

    # --- Traffic data queries ---

    async def get_traffic_data(
        self,
        project_id: uuid.UUID,
        start_date: date,
        end_date: date,
        provider: str | None = None,
    ) -> list[TrafficSnapshot]:
        stmt = (
            select(TrafficSnapshot)
            .where(
                TrafficSnapshot.project_id == project_id,
                TrafficSnapshot.date >= start_date,
                TrafficSnapshot.date <= end_date,
            )
            .order_by(TrafficSnapshot.date)
        )
        if provider:
            stmt = stmt.where(TrafficSnapshot.provider == provider)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_traffic_summary(
        self,
        project_id: uuid.UUID,
        start_date: date,
        end_date: date,
        provider: str | None = None,
    ) -> TrafficSummary:
        snapshots = await self.get_traffic_data(
            project_id, start_date, end_date, provider
        )

        total_pageviews = 0
        total_sessions = 0
        total_users = 0
        agg_sources: dict[str, int] = {}
        daily: list[TrafficDataPoint] = []

        for snap in snapshots:
            total_pageviews += snap.pageviews
            total_sessions += snap.sessions
            total_users += snap.users
            for src, count in (snap.traffic_sources or {}).items():
                agg_sources[src] = agg_sources.get(src, 0) + count
            daily.append(
                TrafficDataPoint(
                    date=snap.date,
                    pageviews=snap.pageviews,
                    sessions=snap.sessions,
                    users=snap.users,
                    traffic_sources=snap.traffic_sources or {},
                )
            )

        return TrafficSummary(
            provider=provider,
            period_start=start_date,
            period_end=end_date,
            total_pageviews=total_pageviews,
            total_sessions=total_sessions,
            total_users=total_users,
            daily=daily,
            traffic_sources=agg_sources,
        )

    async def upsert_snapshots(
        self,
        project_id: uuid.UUID,
        provider: str,
        data_points: list[TrafficDataPoint],
    ) -> int:
        """Upsert traffic snapshots. Returns count of rows upserted."""
        count = 0
        for dp in data_points:
            stmt = select(TrafficSnapshot).where(
                TrafficSnapshot.project_id == project_id,
                TrafficSnapshot.provider == provider,
                TrafficSnapshot.date == dp.date,
            )
            result = await self.db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                existing.pageviews = dp.pageviews
                existing.sessions = dp.sessions
                existing.users = dp.users
                existing.traffic_sources = dp.traffic_sources
            else:
                self.db.add(
                    TrafficSnapshot(
                        project_id=project_id,
                        provider=provider,
                        date=dp.date,
                        pageviews=dp.pageviews,
                        sessions=dp.sessions,
                        users=dp.users,
                        traffic_sources=dp.traffic_sources,
                    )
                )
            count += 1

        await self.db.flush()
        return count

    async def delete_project_data(self, project_id: uuid.UUID) -> None:
        """Delete all analytics data for a project."""
        await self.db.execute(
            delete(TrafficSnapshot).where(TrafficSnapshot.project_id == project_id)
        )
        await self.db.execute(
            delete(AnalyticsIntegration).where(
                AnalyticsIntegration.project_id == project_id
            )
        )
        await self.db.flush()
