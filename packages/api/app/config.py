import base64
from binascii import Error as BinasciiError

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://aeogeo:localdev@localhost:5432/aeogeo"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "change-me"
    cors_origins: str = "http://localhost:5173"
    debug: bool = False
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    encryption_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    tavily_api_key: str = ""
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    clerk_frontend_api_url: str = ""
    clerk_api_url: str = "https://api.clerk.com/v1"
    clerk_invitation_redirect_url: str = ""
    clerk_webhook_secret: str = ""

    model_config = {"env_file": ".env"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def clerk_enabled(self) -> bool:
        return bool(self.clerk_publishable_key and self.clerk_secret_key)

    @property
    def clerk_frontend_origin(self) -> str:
        if self.clerk_frontend_api_url:
            return self._normalize_origin(self.clerk_frontend_api_url)

        host = self._decode_clerk_frontend_host(self.clerk_publishable_key)
        if not host:
            return ""
        return f"https://{host}"

    @property
    def clerk_openid_configuration_url(self) -> str:
        origin = self.clerk_frontend_origin
        return f"{origin}/.well-known/openid-configuration" if origin else ""

    @property
    def clerk_jwks_url(self) -> str:
        origin = self.clerk_frontend_origin
        return f"{origin}/.well-known/jwks.json" if origin else ""

    @property
    def default_web_origin(self) -> str:
        origins = self.cors_origins_list
        return origins[0].rstrip("/") if origins else "http://localhost:5173"

    @property
    def clerk_invitation_redirect_url_value(self) -> str:
        if self.clerk_invitation_redirect_url:
            return self.clerk_invitation_redirect_url.rstrip("/")
        return f"{self.default_web_origin}/accept-invite"

    @staticmethod
    def _normalize_origin(value: str) -> str:
        origin = value.rstrip("/")
        if origin.startswith("http://") or origin.startswith("https://"):
            return origin
        return f"https://{origin}"

    @staticmethod
    def _decode_clerk_frontend_host(publishable_key: str) -> str:
        if not publishable_key:
            return ""

        encoded = publishable_key.rsplit("_", 1)[-1]
        padding = "=" * ((4 - len(encoded) % 4) % 4)

        try:
            decoded = base64.b64decode(encoded + padding).decode("utf-8")
        except (ValueError, BinasciiError, UnicodeDecodeError):
            return ""

        return decoded.rstrip("$")
