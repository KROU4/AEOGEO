"""Content quality and E-E-A-T audit — code metrics + optional GPT-4o-mini scoring."""

from __future__ import annotations

import json
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from geo_audit.models import AuditIssue, ContentQualityResult

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_SENTENCE_SPLIT_RE = re.compile(r"[.!?]+")
_NUMBER_RE = re.compile(r"\b\d+(?:[.,]\d+)?%|\$[\d,]+|\b\d+(?:,\d{3})*\b")
_AUTHOR_TEXT_RE = re.compile(
    r"\bby\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b",
    re.IGNORECASE,
)


def _extract_text_metrics(soup: BeautifulSoup, base_domain: str) -> dict[str, object]:
    for el in soup.find_all(
        ["script", "style", "nav", "footer", "header", "aside", "form"]
    ):
        el.decompose()

    headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
    heading_depth = 0
    if headings:
        heading_depth = max(
            int(h.name[1]) for h in headings if h.name and h.name[1:].isdigit()
        )

    paragraphs = soup.find_all("p")
    qualifying_paragraphs = [
        p for p in paragraphs if len(p.get_text(strip=True).split()) >= 20
    ]
    paragraph_count = len(qualifying_paragraphs)

    all_text_parts: list[str] = []
    for el in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"]):
        t = el.get_text(strip=True)
        if t:
            all_text_parts.append(t)
    full_text = " ".join(all_text_parts)
    words = full_text.split()
    word_count = len(words)

    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(full_text) if s.strip()]
    avg_sentence_length = (word_count / len(sentences)) if sentences else 0.0

    number_matches = _NUMBER_RE.findall(full_text)
    statistical_density = (len(number_matches) / max(word_count, 1)) * 1000.0

    has_author = False
    meta_author = soup.find(
        "meta", attrs={"name": lambda n: n and n.lower() == "author"}
    )
    if meta_author and meta_author.get("content"):
        has_author = True
    if not has_author:
        for script in soup.find_all("script", type="application/ld+json"):
            if script.string and "author" in script.string.lower():
                try:
                    data = json.loads(script.string)
                    if _has_schema_author(data):
                        has_author = True
                        break
                except (json.JSONDecodeError, TypeError):
                    pass
    if not has_author and _AUTHOR_TEXT_RE.search(full_text):
        has_author = True

    has_publish_date = False
    time_tag = soup.find("time")
    if time_tag:
        has_publish_date = True
    if not has_publish_date:
        date_meta = soup.find(
            "meta", attrs={"property": "article:published_time"}
        ) or soup.find("meta", attrs={"name": "publish_date"})
        if date_meta and date_meta.get("content"):
            has_publish_date = True
    if not has_publish_date:
        for script in soup.find_all("script", type="application/ld+json"):
            if script.string and "datePublished" in script.string:
                has_publish_date = True
                break

    external_link_count = 0
    internal_link_count = 0
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if not isinstance(href, str):
            continue
        if href.startswith("http://") or href.startswith("https://"):
            parsed_href = urlparse(href)
            if parsed_href.netloc and base_domain and base_domain in parsed_href.netloc:
                internal_link_count += 1
            else:
                external_link_count += 1
        elif href.startswith("/") or href.startswith("#"):
            internal_link_count += 1

    return {
        "word_count": word_count,
        "heading_depth": heading_depth,
        "paragraph_count": paragraph_count,
        "avg_sentence_length": round(avg_sentence_length, 1),
        "statistical_density": round(statistical_density, 2),
        "has_author": has_author,
        "has_publish_date": has_publish_date,
        "external_link_count": external_link_count,
        "internal_link_count": internal_link_count,
    }


def _has_schema_author(obj: object) -> bool:
    if isinstance(obj, dict):
        if obj.get("author"):
            return True
        return any(_has_schema_author(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_has_schema_author(item) for item in obj)
    return False


def _article_schema_present(soup: BeautifulSoup) -> bool:
    for script in soup.find_all("script", type="application/ld+json"):
        if script.string and any(
            t in script.string for t in ("Article", "BlogPosting", "NewsArticle")
        ):
            return True
    return False


def _heuristic_eeat(
    *,
    has_author: bool,
    has_publish_date: bool,
    heading_depth: int,
    statistical_density: float,
    is_https: bool,
    has_canonical: bool,
    article_schema: bool,
) -> tuple[float, float, float, float]:
    score_experience = 0.0
    if has_author:
        score_experience += 12.5
    if article_schema:
        score_experience += 12.5

    score_expertise = 0.0
    if heading_depth >= 3:
        score_expertise += 12.0
    if statistical_density >= 5.0:
        score_expertise += 13.0

    score_authoritativeness = 0.0
    if has_author:
        score_authoritativeness += 12.5
    if has_publish_date:
        score_authoritativeness += 12.5

    score_trustworthiness = 0.0
    if is_https:
        score_trustworthiness += 12.5
    if has_canonical:
        score_trustworthiness += 12.5

    return (
        score_experience,
        score_expertise,
        score_authoritativeness,
        score_trustworthiness,
    )


async def _ai_eeat_scores(
    top_blocks: list[str],
    openai_api_key: str,
) -> tuple[float, float, float, float] | None:
    """Call GPT-4o-mini to score E-E-A-T. Returns (exp, exp, auth, trust) each 0-25 or None."""
    combined_text = "\n\n---\n\n".join(top_blocks[:3])
    prompt = (
        "You are an SEO and E-E-A-T evaluator. Read the following web page content and "
        "score it on each of the four E-E-A-T dimensions (0–25 each):\n"
        "- Experience: Does the content demonstrate first-hand experience?\n"
        "- Expertise: Does the content show deep subject matter knowledge?\n"
        "- Authoritativeness: Is there evidence of author credentials or citations?\n"
        "- Trustworthiness: Is the content accurate, transparent, and reliable?\n\n"
        f"Content:\n{combined_text[:3000]}\n\n"
        'Reply ONLY with valid JSON: {"experience": N, "expertise": N, "authoritativeness": N, "trustworthiness": N}'
    )
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "temperature": 0,
                    "max_tokens": 200,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()
            json_match = re.search(r"\{.*\}", text, re.DOTALL)
            if not json_match:
                return None
            scores = json.loads(json_match.group())
            exp = float(scores.get("experience", 0))
            expertise = float(scores.get("expertise", 0))
            auth = float(scores.get("authoritativeness", 0))
            trust = float(scores.get("trustworthiness", 0))
            return (
                min(max(exp, 0.0), 25.0),
                min(max(expertise, 0.0), 25.0),
                min(max(auth, 0.0), 25.0),
                min(max(trust, 0.0), 25.0),
            )
    except Exception:
        return None


def _extract_top_blocks(soup: BeautifulSoup, n: int = 3) -> list[str]:
    """Return the n longest paragraph text blocks."""
    paragraphs = [p.get_text(strip=True) for p in soup.find_all("p")]
    paragraphs = [p for p in paragraphs if len(p.split()) >= 20]
    paragraphs.sort(key=lambda t: len(t), reverse=True)
    return paragraphs[:n]


async def run_content_quality_audit(
    url: str,
    html: str | None = None,
    openai_api_key: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> ContentQualityResult:
    """Run content quality and E-E-A-T audit."""
    parsed = urlparse(url)
    base_domain = parsed.netloc
    is_https = parsed.scheme == "https"
    issues: list[AuditIssue] = []

    if html is None:
        try:
            if client is not None:
                r = await client.get(url, timeout=15.0)
            else:
                async with httpx.AsyncClient(
                    headers=DEFAULT_HEADERS, follow_redirects=True, timeout=15.0
                ) as local_client:
                    r = await local_client.get(url)
            r.raise_for_status()
            html = r.text
        except httpx.HTTPError as exc:
            issues.append(
                AuditIssue(
                    severity="critical",
                    category="content",
                    message=f"Failed to fetch page for content analysis: {exc}",
                    recommendation="Ensure the page is accessible.",
                )
            )
            html = ""

    soup = BeautifulSoup(html, "lxml") if html else BeautifulSoup("", "lxml")

    metrics = _extract_text_metrics(soup, base_domain)
    word_count: int = metrics["word_count"]  # type: ignore[assignment]
    heading_depth: int = metrics["heading_depth"]  # type: ignore[assignment]
    paragraph_count: int = metrics["paragraph_count"]  # type: ignore[assignment]
    avg_sentence_length: float = metrics["avg_sentence_length"]  # type: ignore[assignment]
    statistical_density: float = metrics["statistical_density"]  # type: ignore[assignment]
    has_author: bool = metrics["has_author"]  # type: ignore[assignment]
    has_publish_date: bool = metrics["has_publish_date"]  # type: ignore[assignment]
    external_link_count: int = metrics["external_link_count"]  # type: ignore[assignment]
    internal_link_count: int = metrics["internal_link_count"]  # type: ignore[assignment]

    canonical_tag = soup.find("link", rel="canonical")
    has_canonical = canonical_tag is not None
    article_schema = _article_schema_present(soup)

    (
        score_experience,
        score_expertise,
        score_authoritativeness,
        score_trustworthiness,
    ) = _heuristic_eeat(
        has_author=has_author,
        has_publish_date=has_publish_date,
        heading_depth=heading_depth,
        statistical_density=statistical_density,
        is_https=is_https,
        has_canonical=has_canonical,
        article_schema=article_schema,
    )

    ai_scored = False
    if openai_api_key and html:
        top_blocks = _extract_top_blocks(soup)
        if top_blocks:
            ai_result = await _ai_eeat_scores(top_blocks, openai_api_key)
            if ai_result is not None:
                (
                    score_experience,
                    score_expertise,
                    score_authoritativeness,
                    score_trustworthiness,
                ) = ai_result
                ai_scored = True

    topical_authority_modifier = 0.0
    if statistical_density >= 10.0:
        topical_authority_modifier = 5.0
    elif word_count < 200:
        topical_authority_modifier = -5.0

    total_score = min(
        100.0,
        score_experience
        + score_expertise
        + score_authoritativeness
        + score_trustworthiness
        + topical_authority_modifier,
    )
    total_score = max(0.0, total_score)

    if word_count < 200:
        issues.append(
            AuditIssue(
                severity="warning",
                category="content",
                message=f"Very low word count ({word_count} words). AI engines prefer rich content.",
                recommendation="Expand the page content to at least 500 words with structured sections.",
            )
        )

    if not has_author:
        issues.append(
            AuditIssue(
                severity="warning",
                category="content",
                message="No author attribution found on the page.",
                recommendation="Add author metadata via <meta name='author'> or Person schema.",
            )
        )

    if not has_publish_date:
        issues.append(
            AuditIssue(
                severity="info",
                category="content",
                message="No publish date found on the page.",
                recommendation="Add a <time> element or article:published_time meta tag.",
            )
        )

    if heading_depth < 2:
        issues.append(
            AuditIssue(
                severity="warning",
                category="content",
                message=f"Shallow heading structure (max depth: H{heading_depth}).",
                recommendation="Use H2 and H3 headings to organise content and improve scannability.",
            )
        )

    if statistical_density < 3.0:
        issues.append(
            AuditIssue(
                severity="info",
                category="content",
                message="Low statistical density — few numbers, percentages or dollar amounts.",
                recommendation="Add data points, statistics and research findings to boost citability.",
            )
        )

    if avg_sentence_length > 30:
        issues.append(
            AuditIssue(
                severity="info",
                category="content",
                message=f"Average sentence length is {avg_sentence_length:.1f} words (target 10–20).",
                recommendation="Break long sentences into shorter, clearer statements.",
            )
        )

    return ContentQualityResult(
        score=round(total_score, 1),
        word_count=word_count,
        heading_depth=heading_depth,
        paragraph_count=paragraph_count,
        avg_sentence_length=avg_sentence_length,
        statistical_density=statistical_density,
        has_author=has_author,
        has_publish_date=has_publish_date,
        external_link_count=external_link_count,
        internal_link_count=internal_link_count,
        score_experience=round(score_experience, 1),
        score_expertise=round(score_expertise, 1),
        score_authoritativeness=round(score_authoritativeness, 1),
        score_trustworthiness=round(score_trustworthiness, 1),
        topical_authority_modifier=topical_authority_modifier,
        ai_scored=ai_scored,
        issues=issues,
    )
