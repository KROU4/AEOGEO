"""Traffic sync service — orchestrates pulling data from analytics providers."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analytics import AnalyticsService
from app.services.ga4_client import GA4Client, GA4Error
from app.services.yandex_metrica_client import YandexMetricaClient, YandexMetricaError

logger = logging.getLogger(__name__)


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class TrafficSyncService:
    """Pulls traffic data from configured analytics providers and stores snapshots."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.analytics = AnalyticsService(db)
        self.ga4 = GA4Client()
        self.yandex = YandexMetricaClient()

    async def sync_project(
        self,
        project_id: uuid.UUID,
        days: int = 30,
    ) -> dict[str, int]:
        """Sync traffic data for all active integrations of a project.

        Returns a dict mapping provider -> number of rows synced.
        """
        integrations = await self.analytics.list_integrations(project_id)
        # yesterday (today may be incomplete)
        end_date = date.today() - timedelta(days=1)
        start_date = end_date - timedelta(days=days - 1)

        result: dict[str, int] = {}

        for integration in integrations:
            if not integration.is_active:
                continue

            try:
                credentials = self.analytics.decrypt_credentials(integration)

                if integration.provider == "google_analytics":
                    data_points = await self.ga4.fetch_report(
                        property_id=integration.external_id,
                        service_account_json=credentials,
                        start_date=start_date,
                        end_date=end_date,
                    )
                elif integration.provider == "yandex_metrica":
                    data_points = await self.yandex.fetch_report(
                        counter_id=integration.external_id,
                        oauth_token=credentials,
                        start_date=start_date,
                        end_date=end_date,
                    )
                else:
                    logger.warning("Unknown provider: %s", integration.provider)
                    continue

                count = await self.analytics.upsert_snapshots(
                    project_id=project_id,
                    provider=integration.provider,
                    data_points=data_points,
                )

                integration.last_synced_at = _utcnow_naive()
                await self.db.flush()

                result[integration.provider] = count
                logger.info(
                    "Synced %d rows for project=%s provider=%s",
                    count,
                    project_id,
                    integration.provider,
                )

            except (GA4Error, YandexMetricaError) as exc:
                logger.error(
                    "Failed to sync provider=%s project=%s: %s",
                    integration.provider,
                    project_id,
                    exc,
                )
                result[integration.provider] = 0

        return result

    async def test_connection(
        self,
        integration_id: uuid.UUID,
    ) -> bool:
        """Test whether an integration's credentials are valid."""
        integration = await self.analytics.get_integration(integration_id)
        if integration is None:
            return False

        credentials = self.analytics.decrypt_credentials(integration)

        try:
            if integration.provider == "google_analytics":
                return await self.ga4.test_connection(
                    property_id=integration.external_id,
                    service_account_json=credentials,
                )
            elif integration.provider == "yandex_metrica":
                return await self.yandex.test_connection(
                    counter_id=integration.external_id,
                    oauth_token=credentials,
                )
        except Exception:
            logger.exception(
                "Connection test failed for integration=%s",
                integration_id,
            )

        return False
