import base64
import logging
import warnings
from binascii import Error as BinasciiError
from functools import lru_cache

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

PRODUCTION_WEB_ORIGIN = "https://avop.up.railway.app"


def normalize_postgres_url_for_async(url: str) -> str:
    """Ensure SQLAlchemy async engine URLs use an async driver.

    Railway/Postgres plugins often expose ``postgresql://`` or ``postgres://``.
    ``create_async_engine`` requires e.g. ``postgresql+asyncpg://`` or it fails
    at import time (API never binds; edge returns 502).
    """
    u = url.strip()
    if "://" not in u:
        return u
    scheme, rest = u.split("://", 1)
    if "+" in scheme:
        return u
    if scheme == "postgresql":
        logger.info(
            "DATABASE_URL uses postgresql:// without an async driver; "
            "normalizing to postgresql+asyncpg:// for SQLAlchemy asyncio"
        )
        return f"postgresql+asyncpg://{rest}"
    if scheme == "postgres":
        logger.info(
            "DATABASE_URL uses postgres:// without an async driver; "
            "normalizing to postgresql+asyncpg:// for SQLAlchemy asyncio"
        )
        return f"postgresql+asyncpg://{rest}"
    return u


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://aeogeo:localdev@localhost:5432/aeogeo"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "change-me"
    temporal_host: str = Field(
        default="temporal:7233",
        validation_alias=AliasChoices("TEMPORAL_HOST", "TEMPORAL_ADDRESS"),
    )
    cors_origins: str = f"http://localhost:5173,{PRODUCTION_WEB_ORIGIN}"
    # Match any browser http(s) origin so deploy previews / custom domains work without
    # redeploying CORS_ORIGINS. Set CORS_ORIGIN_REGEX= to disable (then only cors_origins apply).
    cors_origin_regex: str = r"^https?://[^\s]+$"
    debug: bool = False
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    encryption_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    tavily_api_key: str = ""
    # LLM / AI providers — set in server env only (not stored in DB or UI).
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    clerk_frontend_api_url: str = ""
    clerk_api_url: str = "https://api.clerk.com/v1"
    clerk_invitation_redirect_url: str = ""
    clerk_webhook_secret: str = ""
    sentry_dsn: str = ""
    sentry_environment: str = "production"
    log_json: bool = False
    referral_track_webhook_url: str = ""
    site_audit_timeout_minutes: int = 10

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("secret_key", mode="after")
    @classmethod
    def warn_default_secret(cls, value: str) -> str:
        if value == "change-me":
            warnings.warn(
                "SECRET_KEY is 'change-me' — set a real key for production.",
                UserWarning,
                stacklevel=2,
            )
        return value

    @field_validator("debug", mode="before")
    @classmethod
    def normalize_debug(cls, value: object) -> object:
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"release", "prod", "production"}:
                return False
            if lowered in {"dev", "debug", "development"}:
                return True
        return value

    @field_validator("database_url", mode="after")
    @classmethod
    def database_url_async_driver(cls, value: str) -> str:
        return normalize_postgres_url_for_async(value)

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [
            origin.strip().rstrip("/")
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]
        if PRODUCTION_WEB_ORIGIN not in origins:
            origins.append(PRODUCTION_WEB_ORIGIN)
        return origins

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
