"""AI Client — central proxy for all AI provider calls.

All AI features in the platform go through this client, which handles:
1. Rate limit checking
2. API key resolution (with fallback logic)
3. Provider-specific API calls
4. Usage event recording
"""

import time
import uuid
from dataclasses import dataclass

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.tenant_quota import TenantQuota
from app.services.ai_key import AIKeyService
from app.services.ai_usage import AIUsageService
from app.services.rate_limiter import RateLimiter


class UsageLimitError(Exception):
    """Raised when a tenant has exceeded their usage quota."""
    pass


class RateLimitError(Exception):
    """Raised when a tenant has exceeded their rate limit."""
    pass


class NoAPIKeyError(Exception):
    """Raised when no API key is configured for a provider."""
    pass


class ProviderError(Exception):
    """Raised when an AI provider returns an error."""
    def __init__(self, message: str, provider: str, status_code: int | None = None):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code


@dataclass
class AIResponse:
    content: str
    input_tokens: int
    output_tokens: int
    model: str
    provider: str


# OpenRouter model mapping — maps native model names to OpenRouter equivalents
OPENROUTER_MODEL_MAP: dict[str, str] = {
    # OpenAI
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4.1": "openai/gpt-4.1",
    "gpt-4.1-mini": "openai/gpt-4.1-mini",
    "gpt-4.1-nano": "openai/gpt-4.1-nano",
    "o3": "openai/o3",
    "o3-mini": "openai/o3-mini",
    "o4-mini": "openai/o4-mini",
    # Anthropic
    "claude-opus-4-20250514": "anthropic/claude-opus-4-20250514",
    "claude-sonnet-4-20250514": "anthropic/claude-sonnet-4-20250514",
    "claude-haiku-3-5-20241022": "anthropic/claude-3.5-haiku",
    # Google
    "gemini-2.5-pro": "google/gemini-2.5-pro-preview",
    "gemini-2.5-flash": "google/gemini-2.5-flash-preview",
    "gemini-2.0-flash": "google/gemini-2.0-flash-001",
}


class AIClient:
    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
        project_id: uuid.UUID | None = None,
    ):
        self.db = db
        self.redis = redis
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.project_id = project_id
        self.key_service = AIKeyService(db)
        self.usage_service = AIUsageService(db)
        self.rate_limiter = RateLimiter(redis)
        self.settings = Settings()

    async def complete(
        self,
        provider: str,
        model: str,
        messages: list[dict],
        request_type: str,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AIResponse:
        # 1. Get quota and check rate limits
        quota = await self._get_quota()
        rate_check = await self.rate_limiter.check_rate_limit(self.tenant_id, quota)
        if not rate_check.is_allowed:
            if rate_check.reason == "usage.limit_reached":
                raise UsageLimitError("Usage limit reached. Contact your administrator.")
            raise RateLimitError("Too many requests. Please try again shortly.")

        # 2. Resolve API key (with fallback logic)
        api_key = await self.key_service.resolve_key(provider, self.tenant_id)
        using_openrouter = False

        if api_key is None:
            raise NoAPIKeyError(f"No API key configured for {provider}")

        # Detect if we fell back to OpenRouter
        native_key = await self.key_service._find_active_key(provider, self.tenant_id)
        if native_key is None:
            native_key = await self.key_service._find_active_key(provider, None)
        if native_key is None and provider != "openrouter":
            using_openrouter = True

        # 3. Make the actual API call
        start_time = time.monotonic()
        try:
            if using_openrouter:
                result = await self._call_openrouter(
                    api_key, model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                )
            elif provider == "openai":
                result = await self._call_openai(
                    api_key, model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                )
            elif provider == "anthropic":
                result = await self._call_anthropic(
                    api_key, model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                )
            elif provider == "google":
                result = await self._call_google(
                    api_key, model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                )
            elif provider == "openrouter":
                result = await self._call_openrouter(
                    api_key, model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                )
            else:
                raise ProviderError(f"Unknown provider: {provider}", provider)

            duration_ms = int((time.monotonic() - start_time) * 1000)

            # 4. Record usage
            await self.usage_service.record_usage(
                tenant_id=self.tenant_id,
                provider=provider,
                model=model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                request_type=request_type,
                user_id=self.user_id,
                project_id=self.project_id,
                duration_ms=duration_ms,
                status="success",
            )

            # 5. Update rate limit counters
            await self.rate_limiter.increment_usage(
                self.tenant_id, result.input_tokens + result.output_tokens
            )

            return result

        except (UsageLimitError, RateLimitError, NoAPIKeyError):
            raise
        except ProviderError as e:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            await self.usage_service.record_usage(
                tenant_id=self.tenant_id,
                provider=provider,
                model=model,
                input_tokens=0,
                output_tokens=0,
                request_type=request_type,
                user_id=self.user_id,
                project_id=self.project_id,
                duration_ms=duration_ms,
                status="error",
                error_message=str(e),
            )
            raise
        except Exception as e:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            await self.usage_service.record_usage(
                tenant_id=self.tenant_id,
                provider=provider,
                model=model,
                input_tokens=0,
                output_tokens=0,
                request_type=request_type,
                user_id=self.user_id,
                project_id=self.project_id,
                duration_ms=duration_ms,
                status="error",
                error_message=str(e),
            )
            raise ProviderError(str(e), provider)

    async def _call_openai(
        self,
        api_key: str,
        model: str,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AIResponse:
        body: dict = {"model": model, "messages": messages}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )

        if resp.status_code != 200:
            raise ProviderError(
                f"OpenAI API error: {resp.status_code} {resp.text[:200]}",
                "openai",
                resp.status_code,
            )

        data = resp.json()
        usage = data.get("usage", {})
        return AIResponse(
            content=data["choices"][0]["message"]["content"],
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            model=model,
            provider="openai",
        )

    async def _call_anthropic(
        self,
        api_key: str,
        model: str,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AIResponse:
        # Convert from OpenAI message format to Anthropic format
        system_msg = None
        anthropic_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_msg = msg["content"]
            else:
                anthropic_messages.append(msg)

        body: dict = {
            "model": model,
            "messages": anthropic_messages,
            "max_tokens": max_tokens or 4096,
        }
        if system_msg:
            body["system"] = system_msg
        if temperature is not None:
            body["temperature"] = temperature

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=body,
            )

        if resp.status_code != 200:
            raise ProviderError(
                f"Anthropic API error: {resp.status_code} {resp.text[:200]}",
                "anthropic",
                resp.status_code,
            )

        data = resp.json()
        usage = data.get("usage", {})
        content_blocks = data.get("content", [])
        text = "".join(
            block["text"] for block in content_blocks if block["type"] == "text"
        )
        return AIResponse(
            content=text,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            model=model,
            provider="anthropic",
        )

    async def _call_google(
        self,
        api_key: str,
        model: str,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AIResponse:
        # Convert OpenAI message format to Gemini format
        system_instruction = None
        gemini_contents = []
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                gemini_contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}],
                })

        body: dict = {"contents": gemini_contents}
        if system_instruction:
            body["system_instruction"] = {"parts": [{"text": system_instruction}]}

        generation_config: dict = {}
        if temperature is not None:
            generation_config["temperature"] = temperature
        if max_tokens is not None:
            generation_config["maxOutputTokens"] = max_tokens
        if generation_config:
            body["generationConfig"] = generation_config

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=body,
            )

        if resp.status_code != 200:
            raise ProviderError(
                f"Google API error: {resp.status_code} {resp.text[:200]}",
                "google",
                resp.status_code,
            )

        data = resp.json()
        candidates = data.get("candidates", [])
        text = ""
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)

        usage_meta = data.get("usageMetadata", {})
        return AIResponse(
            content=text,
            input_tokens=usage_meta.get("promptTokenCount", 0),
            output_tokens=usage_meta.get("candidatesTokenCount", 0),
            model=model,
            provider="google",
        )

    async def _call_openrouter(
        self,
        api_key: str,
        model: str,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AIResponse:
        # Map model name to OpenRouter format if needed
        or_model = OPENROUTER_MODEL_MAP.get(model, model)

        body: dict = {"model": or_model, "messages": messages}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.settings.openrouter_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://sand-source.com",
                    "X-Title": "AEOGEO",
                },
                json=body,
            )

        if resp.status_code != 200:
            raise ProviderError(
                f"OpenRouter API error: {resp.status_code} {resp.text[:200]}",
                "openrouter",
                resp.status_code,
            )

        data = resp.json()
        usage = data.get("usage", {})
        return AIResponse(
            content=data["choices"][0]["message"]["content"],
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            model=model,
            provider="openrouter",
        )

    async def _get_quota(self) -> TenantQuota | None:
        result = await self.db.execute(
            select(TenantQuota).where(TenantQuota.tenant_id == self.tenant_id)
        )
        return result.scalar_one_or_none()
