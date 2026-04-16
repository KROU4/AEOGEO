import asyncio
from uuid import UUID

from app.routers import auth
from app.routers import settings as settings_router


class DummyUser:
    def __init__(self, user_id: UUID, tenant_id: UUID):
        self.id = user_id
        self.tenant_id = tenant_id


def test_auth_notification_preferences_default_and_patch(
    fake_redis, random_user_id, random_tenant_id,
):
    user = DummyUser(random_user_id, random_tenant_id)

    async def run_test():
        defaults = await auth.get_my_notification_preferences(
            current_user=user,
            redis=fake_redis,
        )
        assert defaults.weekly_reports is True
        assert defaults.team_activity is False

        updated = await auth.patch_my_notification_preferences(
            body=auth.NotificationPreferencesUpdate(
                weekly_reports=False,
                team_activity=True,
            ),
            current_user=user,
            redis=fake_redis,
        )
        assert updated.weekly_reports is False
        assert updated.team_activity is True
        assert updated.citation_alerts is True

    asyncio.run(run_test())


def test_settings_integrations_default_and_patch(
    fake_redis, random_user_id, random_tenant_id,
):
    user = DummyUser(random_user_id, random_tenant_id)

    async def run_test():
        defaults = await settings_router.get_integrations(
            user=user,
            redis=fake_redis,
        )
        assert defaults.slack_enabled is False
        assert defaults.generic_webhook_url is None

        updated = await settings_router.patch_integrations(
            body=settings_router.IntegrationSettingsUpdate(
                generic_webhook_url="https://example.com/webhook/aeogeo",
                slack_webhook_url="https://hooks.slack.com/services/T/B/X",
                slack_enabled=True,
            ),
            user=user,
            redis=fake_redis,
        )
        assert updated.slack_enabled is True
        assert str(updated.generic_webhook_url) == "https://example.com/webhook/aeogeo"

    asyncio.run(run_test())
