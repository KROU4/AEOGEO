from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import asyncio
from typing import Any

import httpx
from jose import ExpiredSignatureError, JWTError, jwt

from app.config import Settings

CACHE_TTL = timedelta(minutes=10)
CLERK_TIMEOUT = 15.0


class ClerkError(RuntimeError):
    pass


class ClerkConfigurationError(ClerkError):
    pass


class ClerkTokenVerificationError(ClerkError):
    pass


class ClerkAPIError(ClerkError):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


@dataclass(slots=True)
class ClerkIdentity:
    clerk_user_id: str
    email: str
    name: str
    first_name: str | None = None
    last_name: str | None = None
    image_url: str | None = None


@dataclass(slots=True)
class ClerkInvitation:
    invitation_id: str
    email: str
    status: str
    created_at: datetime | None
    expires_at: datetime | None
    public_metadata: dict[str, Any]


class ClerkService:
    _jwks_cache: dict[str, Any] | None = None
    _jwks_cached_at: datetime | None = None
    _openid_cache: dict[str, Any] | None = None
    _openid_cached_at: datetime | None = None
    _cache_lock = asyncio.Lock()

    def __init__(self, settings: Settings):
        self.settings = settings

    def ensure_configured(self) -> None:
        if not self.settings.clerk_enabled:
            raise ClerkConfigurationError("Clerk is not configured")
        if not self.settings.clerk_frontend_origin:
            raise ClerkConfigurationError("Clerk frontend origin is not configured")

    async def verify_session_token(self, token: str) -> ClerkIdentity:
        self.ensure_configured()

        jwks = await self._get_jwks()
        openid_config = await self._get_openid_configuration()

        try:
            claims = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                issuer=openid_config.get("issuer"),
                options={"verify_aud": False},
            )
        except ExpiredSignatureError as exc:
            raise ClerkTokenVerificationError("Session token expired") from exc
        except JWTError as exc:
            raise ClerkTokenVerificationError("Invalid session token") from exc

        clerk_user_id = claims.get("sub")
        if not isinstance(clerk_user_id, str) or not clerk_user_id:
            raise ClerkTokenVerificationError("Session token is missing a subject")

        email = self._string_or_none(claims.get("email"))
        if not email:
            return await self.get_user(clerk_user_id)

        first_name = self._string_or_none(claims.get("given_name"))
        last_name = self._string_or_none(claims.get("family_name"))
        name = self._string_or_none(claims.get("name"))
        if not name:
            name = " ".join(part for part in [first_name, last_name] if part).strip()
        if not name:
            name = email.split("@", 1)[0]

        return ClerkIdentity(
            clerk_user_id=clerk_user_id,
            email=email.lower(),
            name=name,
            first_name=first_name,
            last_name=last_name,
        )

    async def get_user(self, clerk_user_id: str) -> ClerkIdentity:
        self.ensure_configured()

        payload = await self._request_json(
            "GET",
            f"{self.settings.clerk_api_url.rstrip('/')}/users/{clerk_user_id}",
            headers=self._api_headers(),
        )

        email = self._extract_primary_email(payload)
        if not email:
            raise ClerkAPIError("Clerk user is missing a primary email", status_code=502)

        first_name = self._string_or_none(payload.get("first_name"))
        last_name = self._string_or_none(payload.get("last_name"))
        full_name = self._string_or_none(payload.get("full_name"))
        name = full_name or " ".join(part for part in [first_name, last_name] if part).strip()
        if not name:
            name = email.split("@", 1)[0]

        return ClerkIdentity(
            clerk_user_id=clerk_user_id,
            email=email.lower(),
            name=name,
            first_name=first_name,
            last_name=last_name,
            image_url=self._string_or_none(payload.get("image_url")),
        )

    async def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
        public_metadata: dict[str, Any] | None = None,
    ) -> ClerkInvitation:
        self.ensure_configured()

        payload = await self._request_json(
            "POST",
            f"{self.settings.clerk_api_url.rstrip('/')}/invitations",
            headers=self._api_headers(),
            json={
                "email_address": email,
                "redirect_url": redirect_url,
                "ignore_existing": True,
                "public_metadata": public_metadata or {},
            },
        )

        return self._parse_invitation(payload)

    async def list_pending_invitations(self) -> list[ClerkInvitation]:
        self.ensure_configured()

        payload = await self._request_json(
            "GET",
            f"{self.settings.clerk_api_url.rstrip('/')}/invitations",
            headers=self._api_headers(),
            params={"status": "pending", "limit": 500},
        )

        if not isinstance(payload, list):
            return []

        return [self._parse_invitation(item) for item in payload if isinstance(item, dict)]

    async def _get_openid_configuration(self) -> dict[str, Any]:
        async with self._cache_lock:
            if self._openid_cache and self._is_fresh(self._openid_cached_at):
                return self._openid_cache

            payload = await self._request_json(
                "GET",
                self.settings.clerk_openid_configuration_url,
            )
            if not isinstance(payload, dict):
                raise ClerkAPIError("Invalid Clerk OIDC configuration payload", status_code=502)

            self._openid_cache = payload
            self._openid_cached_at = datetime.now(UTC)
            return payload

    async def _get_jwks(self) -> dict[str, Any]:
        async with self._cache_lock:
            if self._jwks_cache and self._is_fresh(self._jwks_cached_at):
                return self._jwks_cache

            payload = await self._request_json("GET", self.settings.clerk_jwks_url)
            if not isinstance(payload, dict):
                raise ClerkAPIError("Invalid Clerk JWKS payload", status_code=502)

            self._jwks_cache = payload
            self._jwks_cached_at = datetime.now(UTC)
            return payload

    async def _request_json(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        try:
            async with httpx.AsyncClient(timeout=CLERK_TIMEOUT) as client:
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json,
                )
        except httpx.HTTPError as exc:
            raise ClerkAPIError(f"Clerk request failed: {exc!s}", status_code=502) from exc

        if response.is_success:
            return response.json()

        message = self._extract_error_message(response)
        raise ClerkAPIError(message, status_code=response.status_code)

    def _api_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.settings.clerk_secret_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _is_fresh(cached_at: datetime | None) -> bool:
        if cached_at is None:
            return False
        return datetime.now(UTC) - cached_at < CACHE_TTL

    @staticmethod
    def _extract_primary_email(payload: dict[str, Any]) -> str | None:
        primary_id = payload.get("primary_email_address_id")
        email_addresses = payload.get("email_addresses")
        if not isinstance(email_addresses, list):
            return None

        selected: dict[str, Any] | None = None
        for entry in email_addresses:
            if not isinstance(entry, dict):
                continue
            if entry.get("id") == primary_id:
                selected = entry
                break
            if selected is None:
                selected = entry

        if selected is None:
            return None

        email = selected.get("email_address")
        return email if isinstance(email, str) else None

    @staticmethod
    def _parse_invitation(payload: dict[str, Any]) -> ClerkInvitation:
        email = payload.get("email_address")
        invitation_id = payload.get("id")
        status = payload.get("status", "pending")

        if not isinstance(email, str) or not isinstance(invitation_id, str):
            raise ClerkAPIError("Invalid Clerk invitation payload", status_code=502)

        metadata = payload.get("public_metadata")
        return ClerkInvitation(
            invitation_id=invitation_id,
            email=email.lower(),
            status=status if isinstance(status, str) else "pending",
            created_at=ClerkService._parse_timestamp(payload.get("created_at")),
            expires_at=ClerkService._parse_timestamp(payload.get("expires_at")),
            public_metadata=metadata if isinstance(metadata, dict) else {},
        )

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
        if isinstance(value, (int, float)):
            timestamp = value / 1000 if value > 1_000_000_000_000 else value
            try:
                return datetime.fromtimestamp(timestamp, tz=UTC)
            except (OverflowError, OSError, ValueError):
                return None
        return None

    @staticmethod
    def _extract_error_message(response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return f"Clerk request failed with status {response.status_code}"

        errors = payload.get("errors")
        if isinstance(errors, list) and errors:
            first_error = errors[0]
            if isinstance(first_error, dict):
                for key in ("long_message", "message", "code"):
                    value = first_error.get(key)
                    if isinstance(value, str) and value:
                        return value

        detail = payload.get("detail")
        if isinstance(detail, str) and detail:
            return detail

        return f"Clerk request failed with status {response.status_code}"

    @staticmethod
    def _string_or_none(value: Any) -> str | None:
        return value if isinstance(value, str) and value else None
