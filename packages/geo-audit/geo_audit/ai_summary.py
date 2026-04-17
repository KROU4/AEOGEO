"""AI-powered executive summary for GEO site audits.

Calls Claude to generate a contextual executive summary, root cause analysis,
critical issues with CRIT-NN IDs, and a 30-day action plan.
Returns None gracefully if no API key is provided or the call fails.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .models import AiInsights, CriticalIssue

logger = logging.getLogger(__name__)

_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_MODEL = "claude-sonnet-4-6"
_TIMEOUT = 48.0


def _build_prompt(data: dict[str, Any]) -> str:
    url = data.get("url", "unknown")
    score = data.get("overall_geo_score", 0)
    technical = data.get("technical", {})
    schema = data.get("schema", {})
    content = data.get("content", {})
    llmstxt = data.get("llmstxt", {})
    brand = data.get("brand_authority", 0)
    citability = data.get("citability_score", 0)
    platforms = data.get("platforms", {})
    top_issues = data.get("top_issues", [])
    pages = data.get("pages_analyzed", 1)

    # Build concise context for Claude — don't dump everything raw
    context = {
        "url": url,
        "overall_score": score,
        "pages_analyzed": pages,
        "scores": {
            "citability": citability,
            "content_eeat": content.get("score", 0),
            "technical_seo": technical.get("score", 0),
            "structured_data": schema.get("score", 0),
            "platform_readiness": platforms.get("average", 0),
            "brand_authority": brand,
        },
        "technical": {
            "is_https": technical.get("is_https"),
            "has_sitemap": technical.get("has_sitemap"),
            "has_llmstxt": technical.get("has_llmstxt"),
            "has_canonical": technical.get("has_canonical"),
            "ttfb_ms": technical.get("ttfb_ms"),
            "score_ssr": technical.get("score_ssr", 0),
        },
        "schema": {
            "has_organization": schema.get("has_organization"),
            "has_website": schema.get("has_website"),
            "schema_types": schema.get("schema_types", []),
            "same_as_count": schema.get("same_as_count", 0),
            "is_server_rendered": schema.get("is_server_rendered"),
        },
        "content": {
            "word_count": content.get("word_count", 0),
            "heading_depth": content.get("heading_depth", 0),
            "has_author": content.get("has_author"),
            "has_publish_date": content.get("has_publish_date"),
            "score_experience": content.get("score_experience", 0),
            "score_expertise": content.get("score_expertise", 0),
            "score_authoritativeness": content.get("score_authoritativeness", 0),
            "score_trustworthiness": content.get("score_trustworthiness", 0),
        },
        "llmstxt": {
            "has_llmstxt": llmstxt.get("has_llmstxt"),
            "section_count": llmstxt.get("section_count", 0),
            "link_count": llmstxt.get("link_count", 0),
        },
        "platforms": {
            "google_aio": platforms.get("google_aio", 0),
            "chatgpt": platforms.get("chatgpt", 0),
            "perplexity": platforms.get("perplexity", 0),
            "gemini": platforms.get("gemini", 0),
            "copilot": platforms.get("copilot", 0),
        },
        "top_issues": [
            {"severity": i.get("severity"), "category": i.get("category"), "message": i.get("message")}
            for i in top_issues[:8]
        ],
    }

    return f"""You are a GEO (Generative Engine Optimization) expert analyst. Analyze the following site audit data and generate a structured report.

AUDIT DATA:
{json.dumps(context, indent=2)}

Generate a JSON response with exactly this structure:
{{
  "executive_summary": "2-3 paragraph executive summary explaining the overall GEO health of the site. Be specific about what the scores mean for AI visibility. Mention the site URL and key findings.",
  "root_cause": "1-2 sentences identifying the single most impactful root cause behind the low score. Be direct and technical.",
  "critical_issues": [
    {{
      "id": "CRIT-01",
      "title": "Short issue title",
      "detail": "Detailed explanation of why this is a problem for AI visibility, with specific data from the audit",
      "fix": "Specific, actionable fix with implementation details"
    }}
  ],
  "action_plan": {{
    "week1": ["Specific action item 1", "Specific action item 2", "Specific action item 3"],
    "week2": ["Specific action item 1", "Specific action item 2"],
    "week3": ["Specific action item 1", "Specific action item 2"],
    "week4": ["Specific action item 1", "Specific action item 2"]
  }}
}}

Rules:
- Include 3-6 critical issues sorted by impact
- Each action plan week should have 2-4 specific, implementable items
- Be specific to THIS site's data, not generic advice
- Focus on GEO/AI visibility, not traditional SEO
- If word_count is 0, this means the site uses client-side rendering — this is the most critical issue
- Respond ONLY with valid JSON, no markdown, no explanation"""


async def generate_ai_insights(
    result_data: dict[str, Any],
    anthropic_api_key: str,
) -> AiInsights | None:
    """Call Claude to generate an AI-powered audit summary.

    Returns None on any failure — the audit still succeeds without this.
    """
    if not anthropic_api_key:
        return None

    prompt = _build_prompt(result_data)

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                _ANTHROPIC_URL,
                headers={
                    "x-api-key": anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _MODEL,
                    "max_tokens": 2048,
                    "temperature": 0.3,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )

        if resp.status_code != 200:
            logger.warning(
                "ai_summary: Anthropic API error %s: %s",
                resp.status_code,
                resp.text[:200],
            )
            return None

        content_blocks = resp.json().get("content", [])
        text = "".join(b["text"] for b in content_blocks if b.get("type") == "text").strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.rsplit("```", 1)[0].strip()

        parsed = json.loads(text)

        critical_issues = [
            CriticalIssue(
                id=str(issue.get("id", f"CRIT-{i+1:02d}")),
                title=str(issue.get("title", "")),
                detail=str(issue.get("detail", "")),
                fix=str(issue.get("fix", "")),
            )
            for i, issue in enumerate(parsed.get("critical_issues", []))
            if isinstance(issue, dict)
        ]

        action_plan: dict[str, list[str]] = {}
        for week_key in ("week1", "week2", "week3", "week4"):
            items = parsed.get("action_plan", {}).get(week_key, [])
            if isinstance(items, list):
                action_plan[week_key] = [str(item) for item in items]

        return AiInsights(
            executive_summary=str(parsed.get("executive_summary", "")),
            root_cause=str(parsed.get("root_cause", "")),
            critical_issues=critical_issues,
            action_plan=action_plan,
        )

    except json.JSONDecodeError as exc:
        logger.warning("ai_summary: JSON parse error: %s", exc)
        return None
    except Exception as exc:
        logger.warning("ai_summary: Unexpected error: %s", exc)
        return None
