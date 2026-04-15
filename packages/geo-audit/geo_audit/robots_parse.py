# Adapted from geo-seo-claude scripts/fetch_page.py (MIT)

from __future__ import annotations

AI_CRAWLERS = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "anthropic-ai",
    "PerplexityBot",
    "CCBot",
    "Bytespider",
    "cohere-ai",
    "Google-Extended",
    "GoogleOther",
    "Applebot-Extended",
    "FacebookBot",
    "Amazonbot",
]


def parse_robots_txt(content: str) -> dict[str, str]:
    """Return ai_crawler_status map like upstream fetch_page.fetch_robots_txt."""
    lines = content.split("\n")
    current_agent: str | None = None
    agent_rules: dict[str, list[dict[str, str]]] = {}

    for line in lines:
        line = line.strip()
        if line.lower().startswith("user-agent:"):
            current_agent = line.split(":", 1)[1].strip()
            if current_agent not in agent_rules:
                agent_rules[current_agent] = []
        elif line.lower().startswith("disallow:") and current_agent:
            path = line.split(":", 1)[1].strip()
            agent_rules[current_agent].append({"directive": "Disallow", "path": path})
        elif line.lower().startswith("allow:") and current_agent:
            path = line.split(":", 1)[1].strip()
            agent_rules[current_agent].append({"directive": "Allow", "path": path})

    result: dict[str, str] = {}
    for crawler in AI_CRAWLERS:
        if crawler in agent_rules:
            rules = agent_rules[crawler]
            if any(r["directive"] == "Disallow" and r["path"] == "/" for r in rules):
                result[crawler] = "BLOCKED"
            elif any(r["directive"] == "Disallow" and r["path"] for r in rules):
                result[crawler] = "PARTIALLY_BLOCKED"
            else:
                result[crawler] = "ALLOWED"
        elif "*" in agent_rules:
            wildcard_rules = agent_rules["*"]
            if any(
                r["directive"] == "Disallow" and r["path"] == "/"
                for r in wildcard_rules
            ):
                result[crawler] = "BLOCKED_BY_WILDCARD"
            else:
                result[crawler] = "ALLOWED_BY_DEFAULT"
        else:
            result[crawler] = "NOT_MENTIONED"

    return result


def status_implies_crawl_allowed(status: str) -> bool:
    """True if the bot is not fully blocked from the site root."""
    return status not in ("BLOCKED", "BLOCKED_BY_WILDCARD")
