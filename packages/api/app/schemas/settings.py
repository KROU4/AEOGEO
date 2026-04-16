from pydantic import BaseModel, HttpUrl


class IntegrationSettingsResponse(BaseModel):
    generic_webhook_url: HttpUrl | None = None
    slack_webhook_url: HttpUrl | None = None
    slack_enabled: bool = False


class IntegrationSettingsUpdate(BaseModel):
    generic_webhook_url: HttpUrl | None = None
    slack_webhook_url: HttpUrl | None = None
    slack_enabled: bool | None = None
