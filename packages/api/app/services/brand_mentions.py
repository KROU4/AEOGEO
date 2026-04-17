"""Brand mention enrichment using OpenAI with web search.

Called during the pipeline to enrich projects with real-world brand presence data.
Uses gpt-4o-search-preview (built-in web search) via the OpenAI Responses API.
"""

from __future__ import annotations

import json
import logging
import re

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def fetch_brand_mentions(
    brand_name: str,
    domain: str,
) -> dict:
    """Search for brand mentions across key AI-cited platforms.

    Returns a dict with mention data per platform and an overall assessment.
    Falls back to empty data if the search fails (non-blocking).
    """
    settings = get_settings()
    api_key = settings.openai_api_key
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — skipping brand mention enrichment")
        return _empty_result(brand_name, domain)

    system_prompt = """You are a brand intelligence researcher. Search the web and analyze the brand's presence
across key platforms that AI systems cite. Return ONLY valid JSON with this structure:
{
  "brand_name": "...",
  "domain": "...",
  "overall_score": <0-100 integer>,
  "youtube": {"present": bool, "channel_exists": bool, "video_count_estimate": "none|few|moderate|many", "notes": "..."},
  "reddit": {"present": bool, "subreddit_exists": bool, "discussion_sentiment": "positive|neutral|negative|mixed|unknown", "notes": "..."},
  "wikipedia": {"present": bool, "has_article": bool, "notes": "..."},
  "linkedin": {"present": bool, "company_page": bool, "follower_estimate": "none|small|medium|large", "notes": "..."},
  "general_web": {"search_result_count": "none|few|moderate|many", "top_sources": ["source1", "source2"], "notes": "..."},
  "ai_citation_likelihood": "very_low|low|medium|high|very_high",
  "key_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}"""

    user_prompt = f"""Research the brand "{brand_name}" (website: {domain}).
Find and analyze their presence on:
1. YouTube - official channel and brand-related videos
2. Reddit - brand mentions, discussions, subreddits
3. Wikipedia - brand/company article
4. LinkedIn - company page
5. General web presence and authority

Based on your research, return the structured JSON analysis."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-search-preview",
                    "tools": [{"type": "web_search_preview"}],
                    "input": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()

            # Extract text from response output
            raw_text = ""
            for item in data.get("output", []):
                if item.get("type") == "message":
                    for content in item.get("content", []):
                        if content.get("type") == "output_text":
                            raw_text = content.get("text", "")
                            break

            return _parse_mentions_response(raw_text, brand_name, domain)

    except Exception as exc:
        logger.warning("Brand mention search failed for %s: %s", brand_name, exc)
        return _empty_result(brand_name, domain)


def _parse_mentions_response(raw_text: str, brand_name: str, domain: str) -> dict:
    """Extract JSON from OpenAI response text."""
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"(\{.*\})", raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    return _empty_result(brand_name, domain)


def _empty_result(brand_name: str, domain: str) -> dict:
    return {
        "brand_name": brand_name,
        "domain": domain,
        "overall_score": 0,
        "youtube": {"present": False, "channel_exists": False, "video_count_estimate": "none", "notes": ""},
        "reddit": {"present": False, "subreddit_exists": False, "discussion_sentiment": "unknown", "notes": ""},
        "wikipedia": {"present": False, "has_article": False, "notes": ""},
        "linkedin": {"present": False, "company_page": False, "follower_estimate": "none", "notes": ""},
        "general_web": {"search_result_count": "none", "top_sources": [], "notes": ""},
        "ai_citation_likelihood": "very_low",
        "key_recommendations": [],
    }
