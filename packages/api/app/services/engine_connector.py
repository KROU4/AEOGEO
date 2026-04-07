"""Engine Connector adapter system for querying AI engines.

Provides a uniform interface for executing queries against different AI engines
(OpenAI, OpenRouter, Google AI Overviews) used by the engine runner pipeline.

Each adapter implements the EngineConnector ABC and returns a list of RawResponse
objects. The factory function `get_connector` selects the appropriate adapter
based on the Engine model's provider and adapter_config fields.
"""

import asyncio
import logging
import os
import random
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT = 30.0  # seconds per request

SYSTEM_PROMPT = (
    "You are a helpful AI assistant. Answer the user's question thoroughly."
)

# Common browser User-Agent strings for scraping rotation
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
]


@dataclass
class RawResponse:
    """A single raw response from an AI engine."""

    text: str
    metadata: dict = field(default_factory=dict)  # model, tokens, latency, etc.


class EngineConnectorError(Exception):
    """Raised when an engine connector fails to execute a query."""

    def __init__(self, message: str, provider: str, status_code: int | None = None):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------


class EngineConnector(ABC):
    """Abstract base class for all engine connector adapters."""

    @abstractmethod
    async def execute(self, query: str, sample_count: int = 1) -> list[RawResponse]:
        """Execute a query against this engine, returning *sample_count* responses."""
        ...


# ---------------------------------------------------------------------------
# OpenAI Chat Completions adapter
# ---------------------------------------------------------------------------


class OpenAIChatAdapter(EngineConnector):
    """Wraps the OpenAI Chat Completions API (api.openai.com)."""

    BASE_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self, model: str = "gpt-4o", api_key: str | None = None):
        self.model = model
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")

    async def execute(self, query: str, sample_count: int = 1) -> list[RawResponse]:
        if not self.api_key:
            raise EngineConnectorError(
                "OPENAI_API_KEY is not configured", provider="openai"
            )

        results: list[RawResponse] = []
        tasks = [self._single_call(query) for _ in range(sample_count)]
        settled = await asyncio.gather(*tasks, return_exceptions=True)

        for i, outcome in enumerate(settled):
            if isinstance(outcome, Exception):
                logger.error(
                    "OpenAI sample %d/%d failed for model=%s: %s",
                    i + 1,
                    sample_count,
                    self.model,
                    outcome,
                )
                results.append(
                    RawResponse(
                        text="",
                        metadata={
                            "model": self.model,
                            "provider": "openai",
                            "error": str(outcome),
                            "sample_index": i,
                        },
                    )
                )
            else:
                results.append(outcome)

        return results

    async def _single_call(self, query: str) -> RawResponse:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            "temperature": 0.7,
        }

        start = time.monotonic()
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        latency_ms = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise EngineConnectorError(
                f"OpenAI API error: {resp.status_code} {resp.text[:300]}",
                provider="openai",
                status_code=resp.status_code,
            )

        data = resp.json()
        usage = data.get("usage", {})

        return RawResponse(
            text=data["choices"][0]["message"]["content"],
            metadata={
                "model": data.get("model", self.model),
                "provider": "openai",
                "input_tokens": usage.get("prompt_tokens", 0),
                "output_tokens": usage.get("completion_tokens", 0),
                "latency_ms": latency_ms,
            },
        )


# ---------------------------------------------------------------------------
# OpenRouter adapter (used for Gemini, Perplexity, Claude, Copilot, etc.)
# ---------------------------------------------------------------------------


class OpenRouterAdapter(EngineConnector):
    """Wraps the OpenRouter API (OpenAI-compatible format, different base URL).

    Routes queries to any model available on OpenRouter — Gemini, Perplexity,
    Claude, Copilot, etc. — using the model identifier from Engine.model_name.
    """

    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, model: str, api_key: str | None = None):
        self.model = model
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")

    async def execute(self, query: str, sample_count: int = 1) -> list[RawResponse]:
        if not self.api_key:
            raise EngineConnectorError(
                "OPENROUTER_API_KEY is not configured", provider="openrouter"
            )

        results: list[RawResponse] = []
        tasks = [self._single_call(query) for _ in range(sample_count)]
        settled = await asyncio.gather(*tasks, return_exceptions=True)

        for i, outcome in enumerate(settled):
            if isinstance(outcome, Exception):
                logger.error(
                    "OpenRouter sample %d/%d failed for model=%s: %s",
                    i + 1,
                    sample_count,
                    self.model,
                    outcome,
                )
                results.append(
                    RawResponse(
                        text="",
                        metadata={
                            "model": self.model,
                            "provider": "openrouter",
                            "error": str(outcome),
                            "sample_index": i,
                        },
                    )
                )
            else:
                results.append(outcome)

        return results

    async def _single_call(self, query: str) -> RawResponse:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            "temperature": 0.7,
        }

        start = time.monotonic()
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://sand-source.com",
                    "X-Title": "AEOGEO",
                },
                json=body,
            )
        latency_ms = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            raise EngineConnectorError(
                f"OpenRouter API error: {resp.status_code} {resp.text[:300]}",
                provider="openrouter",
                status_code=resp.status_code,
            )

        data = resp.json()
        usage = data.get("usage", {})

        return RawResponse(
            text=data["choices"][0]["message"]["content"],
            metadata={
                "model": data.get("model", self.model),
                "provider": "openrouter",
                "input_tokens": usage.get("prompt_tokens", 0),
                "output_tokens": usage.get("completion_tokens", 0),
                "latency_ms": latency_ms,
            },
        )


# ---------------------------------------------------------------------------
# Google AI Overview scraper (basic httpx implementation)
# ---------------------------------------------------------------------------


class GoogleAIOverviewScraper(EngineConnector):
    """Scrapes Google Search results to extract the AI Overview section.

    This is a basic httpx-based implementation. A full Playwright-backed
    scraper will replace it in a later milestone for better JS rendering
    and anti-bot handling.
    """

    SEARCH_URL = "https://www.google.com/search"
    MAX_RETRIES = 3
    BACKOFF_BASE = 1.0  # seconds — base for exponential backoff

    # Patterns that commonly wrap AI Overview content in Google's HTML.
    # Google's DOM structure changes frequently; these cover common variants.
    _AI_OVERVIEW_MARKERS = [
        r'<div[^>]*data-attrid="ai_overview"[^>]*>(.*?)</div>',
        r'<div[^>]*class="[^"]*ai-overview[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*id="aio"[^>]*>(.*?)</div>',
        r'<div[^>]*class="[^"]*kp-blk[^"]*"[^>]*>(.*?)</div>',
    ]

    async def execute(self, query: str, sample_count: int = 1) -> list[RawResponse]:
        """Scrape Google for AI Overview. sample_count > 1 retries the same
        query multiple times (useful to capture variance in AI Overview text)."""
        results: list[RawResponse] = []

        for i in range(sample_count):
            start = time.monotonic()
            try:
                text, raw_html_len = await self._scrape_with_retry(query)
                latency_ms = int((time.monotonic() - start) * 1000)

                if text:
                    results.append(
                        RawResponse(
                            text=text,
                            metadata={
                                "provider": "google_aio",
                                "source": "scraper",
                                "latency_ms": latency_ms,
                                "html_length": raw_html_len,
                                "sample_index": i,
                            },
                        )
                    )
                else:
                    results.append(
                        RawResponse(
                            text="",
                            metadata={
                                "provider": "google_aio",
                                "source": "scraper",
                                "latency_ms": latency_ms,
                                "html_length": raw_html_len,
                                "note": "no_ai_overview",
                                "sample_index": i,
                            },
                        )
                    )
            except Exception as exc:
                latency_ms = int((time.monotonic() - start) * 1000)
                logger.error(
                    "Google AIO scrape sample %d/%d failed: %s",
                    i + 1,
                    sample_count,
                    exc,
                )
                results.append(
                    RawResponse(
                        text="",
                        metadata={
                            "provider": "google_aio",
                            "source": "scraper",
                            "error": str(exc),
                            "latency_ms": latency_ms,
                            "sample_index": i,
                        },
                    )
                )

        return results

    async def _scrape_with_retry(self, query: str) -> tuple[str, int]:
        """Attempt to scrape with exponential backoff on 429/503 responses.

        Returns (extracted_text, html_byte_length).
        """
        last_exc: Exception | None = None

        for attempt in range(self.MAX_RETRIES):
            try:
                return await self._do_scrape(query)
            except EngineConnectorError as exc:
                last_exc = exc
                if exc.status_code in (429, 503) and attempt < self.MAX_RETRIES - 1:
                    wait = self.BACKOFF_BASE * (2**attempt) + random.uniform(0, 0.5)
                    logger.warning(
                        "Google returned %d, retrying in %.1fs (attempt %d/%d)",
                        exc.status_code,
                        wait,
                        attempt + 1,
                        self.MAX_RETRIES,
                    )
                    await asyncio.sleep(wait)
                else:
                    raise

        # Should not reach here, but satisfy the type checker
        raise last_exc  # type: ignore[misc]

    async def _do_scrape(self, query: str) -> tuple[str, int]:
        """Perform a single Google search and extract the AI Overview."""
        user_agent = random.choice(_USER_AGENTS)

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        ) as client:
            resp = await client.get(
                self.SEARCH_URL,
                params={"q": query, "hl": "en", "gl": "us"},
                headers={
                    "User-Agent": user_agent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )

        if resp.status_code != 200:
            raise EngineConnectorError(
                f"Google search returned {resp.status_code}",
                provider="google_aio",
                status_code=resp.status_code,
            )

        html = resp.text
        html_len = len(html.encode("utf-8", errors="replace"))

        # Try each marker pattern to find the AI Overview section
        for pattern in self._AI_OVERVIEW_MARKERS:
            match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
            if match:
                raw_block = match.group(1)
                text = self._strip_html(raw_block)
                if text.strip():
                    return text.strip(), html_len

        # No AI Overview found — not an error, just no overview for this query
        return "", html_len

    @staticmethod
    def _strip_html(html: str) -> str:
        """Naively strip HTML tags and collapse whitespace."""
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text)
        return text.strip()


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def get_connector(engine, api_key: str | None = None) -> EngineConnector:
    """Create the appropriate connector for an Engine model instance.

    Selection logic:
    - provider == "openai" -> OpenAIChatAdapter (direct OpenAI API)
    - provider == "google" with adapter_config.type == "scraper" -> GoogleAIOverviewScraper
    - provider in ("google", "openrouter") -> OpenRouterAdapter
    - provider == "anthropic" -> OpenRouterAdapter (routed via OpenRouter)
    - anything else -> OpenRouterAdapter (best-effort via OpenRouter)
    """
    provider: str = getattr(engine, "provider", "")
    model_name: str | None = getattr(engine, "model_name", None)
    adapter_config: dict | None = getattr(engine, "adapter_config", None)

    if provider == "openai":
        return OpenAIChatAdapter(model=model_name or "gpt-5.4-mini", api_key=api_key)

    if provider in ("google", "openrouter"):
        if adapter_config and adapter_config.get("type") == "scraper":
            return GoogleAIOverviewScraper()
        return OpenRouterAdapter(model=model_name or provider, api_key=api_key)

    if provider == "anthropic":
        # Route Anthropic models through OpenRouter to avoid managing a
        # separate Anthropic API key for measurement queries.
        return OpenRouterAdapter(model=model_name or "anthropic/claude-haiku-4.5", api_key=api_key)

    # Fallback: try OpenRouter with whatever model_name is set
    logger.warning(
        "Unknown provider %r for engine %r — falling back to OpenRouter",
        provider,
        getattr(engine, "name", "?"),
    )
    return OpenRouterAdapter(model=model_name or provider, api_key=api_key)
