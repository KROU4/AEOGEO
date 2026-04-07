"""Discovery service for draft product and competitor suggestions."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.brand import Brand
from app.models.competitor import Competitor
from app.models.knowledge import KnowledgeEntry
from app.models.product import Product
from app.models.project import Project
from app.schemas.competitor import (
    CompetitorSuggestion,
    CompetitorSuggestionResponse,
)
from app.schemas.product import ProductSuggestion, ProductSuggestionResponse
from app.services.ai_client import AIClient
from app.utils.locale import locale_instruction

logger = logging.getLogger(__name__)

PRODUCT_DISCOVERY_SYSTEM_PROMPT = """\
You are a product discovery analyst.
Identify concrete products or services that the brand offers from the provided crawled knowledge.

Return JSON in this shape:
{
  "suggestions": [
    {
      "name": "Product or service name",
      "description": "Short explanation of the offering",
      "category": "Optional category",
      "pricing": "Optional pricing summary",
      "features": ["Feature 1", "Feature 2"],
      "evidence": ["Short supporting excerpt"],
      "source_urls": ["https://example.com/page"]
    }
  ]
}

Rules:
- Use only the supplied knowledge excerpts as evidence.
- Suggest real offerings, not generic capabilities, slogans, or brand claims.
- Prefer distinct product lines or services the brand appears to sell.
- Keep descriptions concise.
- Keep features, evidence, and source_urls to at most 5, 3, and 3 items respectively.
- If the evidence is weak, omit the suggestion.
- Return only valid JSON.
"""

COMPETITOR_DISCOVERY_SYSTEM_PROMPT = """\
You are a competitive intelligence analyst.
Given a brand profile and search results, identify likely direct competitors.

Return JSON in this shape:
{
  "suggestions": [
    {
      "name": "Competitor company name",
      "website": "Optional competitor website if clearly identifiable",
      "positioning": "Short summary of how they compete",
      "notes": "Why they appear relevant",
      "evidence": ["Short supporting excerpt"],
      "source_urls": ["https://example.com/page"]
    }
  ]
}

Rules:
- Exclude the brand itself.
- Prefer direct competitors over publishers, directories, agencies, or marketplaces.
- Only include companies supported by the search results.
- Leave website empty if it is not clear from the evidence.
- Keep evidence and source_urls to at most 3 items each.
- Return only valid JSON.
"""

PRODUCT_ENTRY_TYPES = {"product", "faq", "fact", "claim"}


class DiscoveryError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


@dataclass
class BrandContext:
    brand: Brand
    existing_products: list[Product]
    existing_competitors: list[Competitor]
    knowledge_entries: list[KnowledgeEntry]
    content_locale: str = "en"


class DiscoveryService:
    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        tenant_id: UUID,
        user_id: UUID,
        project_id: UUID,
    ):
        self.db = db
        self.redis = redis
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.project_id = project_id
        self.settings = Settings()
        self.ai_client = AIClient(
            db=db,
            redis=redis,
            tenant_id=tenant_id,
            user_id=user_id,
            project_id=project_id,
        )

    async def suggest_products(
        self, project_id: UUID, max_suggestions: int
    ) -> ProductSuggestionResponse:
        context = await self._load_brand_context(project_id)
        knowledge_entries = self._select_product_knowledge(context.knowledge_entries)
        if not knowledge_entries:
            raise DiscoveryError(
                400,
                "discovery.no_knowledge",
                "No crawled knowledge is available yet. Crawl the website first.",
            )

        prompt = self._build_product_prompt(
            brand=context.brand,
            knowledge_entries=knowledge_entries,
            existing_products=context.existing_products,
            max_suggestions=max_suggestions,
        )
        response = await self.ai_client.complete(
            provider="openai",
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PRODUCT_DISCOVERY_SYSTEM_PROMPT + locale_instruction(context.content_locale)},
                {"role": "user", "content": prompt},
            ],
            request_type="product_discovery",
            temperature=0.2,
            max_tokens=1600,
        )
        await self.db.commit()

        parsed = self._parse_json_payload(response.content)
        suggestions = self._coerce_product_suggestions(
            parsed,
            existing_names={self._normalize_name(item.name) for item in context.existing_products},
            max_suggestions=max_suggestions,
        )
        return ProductSuggestionResponse(
            suggestions=suggestions,
            knowledge_entries_considered=len(knowledge_entries),
        )

    async def suggest_competitors(
        self, project_id: UUID, max_suggestions: int
    ) -> CompetitorSuggestionResponse:
        context = await self._load_brand_context(project_id)
        if not self.settings.tavily_api_key:
            raise DiscoveryError(
                503,
                "search.not_configured",
                "Tavily is not configured for competitor discovery.",
            )

        search_results = await self._search_competitors(
            brand=context.brand,
            existing_products=context.existing_products,
            max_suggestions=max_suggestions,
            existing_competitors=context.existing_competitors,
        )
        if not search_results:
            return CompetitorSuggestionResponse(
                suggestions=[],
                search_results_considered=0,
            )

        prompt = self._build_competitor_prompt(
            brand=context.brand,
            existing_products=context.existing_products,
            search_results=search_results,
            max_suggestions=max_suggestions,
        )
        response = await self.ai_client.complete(
            provider="openai",
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": COMPETITOR_DISCOVERY_SYSTEM_PROMPT + locale_instruction(context.content_locale)},
                {"role": "user", "content": prompt},
            ],
            request_type="competitor_discovery",
            temperature=0.2,
            max_tokens=1600,
        )
        await self.db.commit()

        parsed = self._parse_json_payload(response.content)
        own_domain = self._hostname(context.brand.website)
        suggestions = self._coerce_competitor_suggestions(
            parsed,
            existing_names={
                self._normalize_name(item.name)
                for item in context.existing_competitors
            },
            existing_domains={
                self._hostname(item.website)
                for item in context.existing_competitors
                if item.website
            },
            own_domain=own_domain,
            max_suggestions=max_suggestions,
        )
        return CompetitorSuggestionResponse(
            suggestions=suggestions,
            search_results_considered=len(search_results),
        )

    async def _load_brand_context(self, project_id: UUID) -> BrandContext:
        project = await self.db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.tenant_id == self.tenant_id,
            )
        )
        if project is None:
            raise DiscoveryError(404, "project.not_found", "Project not found")

        brand = await self.db.scalar(
            select(Brand).where(Brand.project_id == project_id)
        )
        if brand is None:
            raise DiscoveryError(404, "brand.not_found", "Brand not found")

        products = list(
            (
                await self.db.scalars(
                    select(Product)
                    .where(Product.brand_id == brand.id)
                    .order_by(Product.created_at.desc())
                )
            ).all()
        )
        competitors = list(
            (
                await self.db.scalars(
                    select(Competitor)
                    .where(Competitor.brand_id == brand.id)
                    .order_by(Competitor.created_at.desc())
                )
            ).all()
        )
        knowledge_entries = list(
            (
                await self.db.scalars(
                    select(KnowledgeEntry)
                    .where(KnowledgeEntry.brand_id == brand.id)
                    .order_by(KnowledgeEntry.created_at.desc())
                    .limit(120)
                )
            ).all()
        )

        return BrandContext(
            brand=brand,
            existing_products=products,
            existing_competitors=competitors,
            knowledge_entries=knowledge_entries,
            content_locale=project.content_locale or "en",
        )

    async def _search_competitors(
        self,
        brand: Brand,
        existing_products: list[Product],
        existing_competitors: list[Competitor],
        max_suggestions: int,
    ) -> list[dict[str, Any]]:
        query = self._build_competitor_search_query(brand, existing_products)
        exclude_domains = [
            domain
            for domain in {
                self._hostname(brand.website),
                *(
                    self._hostname(competitor.website)
                    for competitor in existing_competitors
                    if competitor.website
                ),
            }
            if domain
        ]

        payload: dict[str, Any] = {
            "query": query,
            "topic": "general",
            "search_depth": "advanced",
            "max_results": min(max(max_suggestions * 3, 6), 12),
            "include_answer": False,
            "include_raw_content": False,
            "include_usage": True,
        }
        if exclude_domains:
            payload["exclude_domains"] = exclude_domains

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                headers={
                    "Authorization": f"Bearer {self.settings.tavily_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if response.status_code != 200:
            logger.error(
                "Tavily search failed for project %s: %s %s",
                self.project_id,
                response.status_code,
                response.text[:400],
            )
            raise DiscoveryError(
                502,
                "search.provider_error",
                "Competitor search failed. Please try again.",
            )

        data = response.json()
        results = data.get("results", [])
        if not isinstance(results, list):
            return []
        return [result for result in results if isinstance(result, dict)]

    def _build_product_prompt(
        self,
        brand: Brand,
        knowledge_entries: list[KnowledgeEntry],
        existing_products: list[Product],
        max_suggestions: int,
    ) -> str:
        sections = [
            f"Brand name: {brand.name}",
            f"Brand website: {brand.website or ''}",
            f"Brand description: {brand.description or ''}",
            f"Existing products to exclude: {', '.join(item.name for item in existing_products) or 'None'}",
            f"Maximum suggestions: {max_suggestions}",
            "",
            "Knowledge excerpts:",
            self._format_knowledge_entries(knowledge_entries, max_chars=16_000),
            "",
            "Return the JSON object now.",
        ]
        return "\n".join(sections)

    def _build_competitor_prompt(
        self,
        brand: Brand,
        existing_products: list[Product],
        search_results: list[dict[str, Any]],
        max_suggestions: int,
    ) -> str:
        sections = [
            f"Brand name: {brand.name}",
            f"Brand website: {brand.website or ''}",
            f"Brand description: {brand.description or ''}",
            f"Brand positioning: {brand.positioning or ''}",
            f"Known products/services: {', '.join(item.name for item in existing_products) or 'None'}",
            f"Maximum suggestions: {max_suggestions}",
            "",
            "Search results:",
            self._format_search_results(search_results, max_chars=18_000),
            "",
            "Return the JSON object now.",
        ]
        return "\n".join(sections)

    def _build_competitor_search_query(
        self, brand: Brand, existing_products: list[Product]
    ) -> str:
        domain = self._hostname(brand.website)
        product_terms = ", ".join(item.name for item in existing_products[:3])
        brand_terms = " ".join(
            term
            for term in [
                f"\"{brand.name}\"" if brand.name else "",
                f"\"{domain}\"" if domain else "",
            ]
            if term
        )
        context = " ".join(
            part
            for part in [
                product_terms,
                (brand.description or "")[:160],
            ]
            if part
        ).strip()
        if context:
            return f"{brand_terms} competitors alternatives similar companies {context}".strip()
        return f"{brand_terms} competitors alternatives similar companies".strip()

    def _select_product_knowledge(
        self, knowledge_entries: list[KnowledgeEntry]
    ) -> list[KnowledgeEntry]:
        prioritized = sorted(
            knowledge_entries,
            key=lambda entry: (
                0 if (entry.type or "").lower() in PRODUCT_ENTRY_TYPES else 1,
                -len(entry.content or ""),
            ),
        )
        selected: list[KnowledgeEntry] = []
        seen_content: set[str] = set()
        total_chars = 0
        for entry in prioritized:
            content = self._compact_text(entry.content)
            if not content:
                continue
            key = content.lower()
            if key in seen_content:
                continue
            selected.append(entry)
            seen_content.add(key)
            total_chars += len(content)
            if len(selected) >= 40 or total_chars >= 18_000:
                break
        return selected

    def _format_knowledge_entries(
        self, knowledge_entries: list[KnowledgeEntry], max_chars: int
    ) -> str:
        chunks: list[str] = []
        total_chars = 0
        for index, entry in enumerate(knowledge_entries, start=1):
            content = self._truncate(self._compact_text(entry.content), 420)
            if not content:
                continue
            line = (
                f"[{index}] type={entry.type} url={entry.source_url or ''} "
                f"content={content}"
            )
            if total_chars + len(line) > max_chars:
                break
            chunks.append(line)
            total_chars += len(line)
        return "\n".join(chunks)

    def _format_search_results(
        self, search_results: list[dict[str, Any]], max_chars: int
    ) -> str:
        chunks: list[str] = []
        total_chars = 0
        for index, result in enumerate(search_results, start=1):
            title = self._truncate(self._compact_text(str(result.get("title", ""))), 180)
            url = self._truncate(str(result.get("url", "")), 220)
            content = self._truncate(
                self._compact_text(str(result.get("content", ""))),
                500,
            )
            if not title and not content:
                continue
            line = (
                f"[{index}] title={title} url={url} score={result.get('score', '')} "
                f"content={content}"
            )
            if total_chars + len(line) > max_chars:
                break
            chunks.append(line)
            total_chars += len(line)
        return "\n".join(chunks)

    def _coerce_product_suggestions(
        self,
        payload: Any,
        existing_names: set[str],
        max_suggestions: int,
    ) -> list[ProductSuggestion]:
        items = self._extract_suggestions(payload)
        suggestions: list[ProductSuggestion] = []
        seen_names = set(existing_names)
        for item in items:
            name = self._clean_text(item.get("name"))
            if not name:
                continue
            normalized_name = self._normalize_name(name)
            if not normalized_name or normalized_name in seen_names:
                continue

            suggestion = ProductSuggestion(
                name=name,
                description=self._clean_text(item.get("description")),
                category=self._clean_text(item.get("category")),
                pricing=self._clean_text(item.get("pricing")),
                features=self._clean_text_list(item.get("features"), limit=5),
                evidence=self._clean_text_list(item.get("evidence"), limit=3),
                source_urls=self._clean_url_list(item.get("source_urls"), limit=3),
            )
            suggestions.append(suggestion)
            seen_names.add(normalized_name)
            if len(suggestions) >= max_suggestions:
                break
        return suggestions

    def _coerce_competitor_suggestions(
        self,
        payload: Any,
        existing_names: set[str],
        existing_domains: set[str],
        own_domain: str,
        max_suggestions: int,
    ) -> list[CompetitorSuggestion]:
        items = self._extract_suggestions(payload)
        suggestions: list[CompetitorSuggestion] = []
        seen_names = set(existing_names)
        seen_domains = {domain for domain in existing_domains if domain}
        if own_domain:
            seen_domains.add(own_domain)

        for item in items:
            name = self._clean_text(item.get("name"))
            if not name:
                continue
            normalized_name = self._normalize_name(name)
            website = self._normalize_website(self._clean_text(item.get("website")))
            website_domain = self._hostname(website)
            if not normalized_name or normalized_name in seen_names:
                continue
            if website_domain and website_domain in seen_domains:
                continue

            suggestion = CompetitorSuggestion(
                name=name,
                website=website,
                positioning=self._clean_text(item.get("positioning")),
                notes=self._clean_text(item.get("notes")),
                evidence=self._clean_text_list(item.get("evidence"), limit=3),
                source_urls=self._clean_url_list(item.get("source_urls"), limit=3),
            )
            suggestions.append(suggestion)
            seen_names.add(normalized_name)
            if website_domain:
                seen_domains.add(website_domain)
            if len(suggestions) >= max_suggestions:
                break
        return suggestions

    def _extract_suggestions(self, payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, dict):
            raw_items = payload.get("suggestions", [])
        elif isinstance(payload, list):
            raw_items = payload
        else:
            raw_items = []

        return [item for item in raw_items if isinstance(item, dict)]

    def _parse_json_payload(self, raw_content: str) -> Any:
        try:
            return json.loads(raw_content)
        except json.JSONDecodeError:
            pass

        fenced_json_match = re.search(
            r"```(?:json)?\s*([\[{].*[\]}])\s*```",
            raw_content,
            re.DOTALL,
        )
        if fenced_json_match:
            return json.loads(fenced_json_match.group(1))

        json_match = re.search(r"([\[{].*[\]}])", raw_content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))

        raise DiscoveryError(
            502,
            "ai.invalid_json",
            "The AI provider returned invalid JSON.",
        )

    @staticmethod
    def _clean_text(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = re.sub(r"\s+", " ", value).strip()
        return cleaned or None

    @staticmethod
    def _compact_text(value: str | None) -> str:
        if not value:
            return ""
        return re.sub(r"\s+", " ", value).strip()

    @staticmethod
    def _truncate(value: str, limit: int) -> str:
        if len(value) <= limit:
            return value
        return value[: limit - 3].rstrip() + "..."

    @staticmethod
    def _clean_text_list(value: Any, limit: int) -> list[str]:
        if not isinstance(value, list):
            return []
        items: list[str] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, str):
                continue
            cleaned = re.sub(r"\s+", " ", item).strip()
            normalized = cleaned.lower()
            if not cleaned or normalized in seen:
                continue
            items.append(cleaned)
            seen.add(normalized)
            if len(items) >= limit:
                break
        return items

    def _clean_url_list(self, value: Any, limit: int) -> list[str]:
        if not isinstance(value, list):
            return []
        items: list[str] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, str):
                continue
            normalized = self._normalize_website(item)
            if not normalized or normalized in seen:
                continue
            items.append(normalized)
            seen.add(normalized)
            if len(items) >= limit:
                break
        return items

    @staticmethod
    def _normalize_name(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", value.lower())

    @staticmethod
    def _normalize_website(value: str | None) -> str | None:
        if not value:
            return None
        website = value.strip()
        if not website:
            return None
        if not website.startswith(("http://", "https://")):
            website = f"https://{website}"
        parsed = urlparse(website)
        if not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")

    @staticmethod
    def _hostname(value: str | None) -> str:
        if not value:
            return ""
        candidate = value if value.startswith(("http://", "https://")) else f"https://{value}"
        parsed = urlparse(candidate)
        hostname = (parsed.hostname or "").lower()
        return hostname[4:] if hostname.startswith("www.") else hostname
