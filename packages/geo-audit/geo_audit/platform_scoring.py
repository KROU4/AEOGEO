"""Platform-specific AI search scoring — pure code, no AI calls."""

from __future__ import annotations

from geo_audit.models import PlatformScores
from geo_audit.robots_parse import status_implies_crawl_allowed

_BING_CRAWLERS = ("Bingbot", "BingPreview", "MicrosoftPreview")


def _crawler_allowed(ai_crawler_access: dict[str, str], crawler: str) -> bool:
    status = ai_crawler_access.get(crawler, "NOT_MENTIONED")
    return status_implies_crawl_allowed(status)


def _any_schema_present(schema_types: list[str]) -> bool:
    return len(schema_types) > 0


def _no_bing_block(ai_crawler_access: dict[str, str]) -> bool:
    """True if there is no explicit full block for Bing crawlers."""
    for crawler in _BING_CRAWLERS:
        status = ai_crawler_access.get(crawler, "NOT_MENTIONED")
        if status in ("BLOCKED", "BLOCKED_BY_WILDCARD"):
            return False
    return True


def compute_platform_scores(
    *,
    ai_crawler_access: dict[str, str],
    has_sitemap: bool,
    has_llmstxt: bool,
    schema_types: list[str],
    has_og_tags: bool,
    citability_score: float,
    technical_score: float,
    schema_score: float,
    heading_depth: int,
) -> PlatformScores:
    """Compute per-platform AI search readiness scores (0-100 each)."""
    schema_present = _any_schema_present(schema_types)
    org_or_article = bool(
        set(schema_types)
        & {"Organization", "LocalBusiness", "Article", "BlogPosting", "NewsArticle"}
    )

    # --- Google AIO ---
    google_aio = 0.0
    google_extended_allowed = _crawler_allowed(ai_crawler_access, "Google-Extended")
    googleother_allowed = _crawler_allowed(ai_crawler_access, "GoogleOther")
    if google_extended_allowed or googleother_allowed:
        google_aio += 30.0
    if org_or_article:
        google_aio += 20.0
    google_aio += citability_score * 0.20
    if heading_depth >= 3:
        google_aio += 15.0
    if has_sitemap:
        google_aio += 15.0
    google_aio = min(google_aio, 100.0)

    # --- ChatGPT ---
    chatgpt = 0.0
    gptbot_allowed = _crawler_allowed(ai_crawler_access, "GPTBot")
    oai_allowed = _crawler_allowed(ai_crawler_access, "OAI-SearchBot")
    if gptbot_allowed:
        chatgpt += 25.0
    else:
        gptbot_status = ai_crawler_access.get("GPTBot", "NOT_MENTIONED")
        if gptbot_status == "PARTIALLY_BLOCKED":
            chatgpt += 12.5
    if oai_allowed:
        chatgpt += 25.0
    else:
        oai_status = ai_crawler_access.get("OAI-SearchBot", "NOT_MENTIONED")
        if oai_status == "PARTIALLY_BLOCKED":
            chatgpt += 12.5
    if schema_present:
        chatgpt += 25.0
    chatgpt += citability_score * 0.25
    chatgpt = min(chatgpt, 100.0)

    # --- Perplexity ---
    perplexity = 0.0
    perplexity_allowed = _crawler_allowed(ai_crawler_access, "PerplexityBot")
    if perplexity_allowed:
        perplexity += 30.0
    if schema_present and has_sitemap:
        perplexity += 35.0
    elif schema_present or has_sitemap:
        perplexity += 17.5
    perplexity += citability_score * 0.35
    perplexity = min(perplexity, 100.0)

    # --- Gemini ---
    gemini = 0.0
    google_extended_allowed_gemini = _crawler_allowed(ai_crawler_access, "Google-Extended")
    if google_extended_allowed_gemini:
        gemini += 30.0
    if schema_present:
        gemini += 35.0
    gemini += citability_score * 0.35
    gemini = min(gemini, 100.0)

    # --- Copilot (Bing) ---
    copilot = 0.0
    if _no_bing_block(ai_crawler_access):
        copilot += 30.0
    if schema_present:
        copilot += 35.0
    copilot += citability_score * 0.35
    copilot = min(copilot, 100.0)

    average = round((google_aio + chatgpt + perplexity + gemini + copilot) / 5.0, 1)

    return PlatformScores(
        google_aio=round(google_aio, 1),
        chatgpt=round(chatgpt, 1),
        perplexity=round(perplexity, 1),
        gemini=round(gemini, 1),
        copilot=round(copilot, 1),
        average=average,
    )
