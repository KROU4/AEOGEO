"""Keyword service — CRUD and AI-powered keyword generation."""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.models.keyword import Keyword
from app.models.knowledge import KnowledgeEntry
from app.models.project import Project
from app.schemas.keyword import (
    KeywordBulkCreate,
    KeywordCreate,
    KeywordGenerateResponse,
    KeywordResponse,
    KeywordUpdate,
)
from app.services.ai_client import AIClient
from app.utils.locale import locale_instruction

logger = logging.getLogger(__name__)

KEYWORD_GENERATION_SYSTEM_PROMPT = """\
You are an SEO and AI visibility keyword analyst.
Given a brand profile and crawled knowledge about a company, generate a list of
SEO-style keywords and search terms that the brand should rank for in AI answer engines.

Return JSON in this shape:
{
  "keywords": [
    {
      "keyword": "search term or phrase",
      "category": "product|brand|industry|competitor|informational",
      "relevance_score": 0.85
    }
  ]
}

Rules:
- Generate keywords that real users would type into AI assistants
  (ChatGPT, Gemini, Perplexity, Claude).
- Include a mix of categories: brand-specific, product-related,
  industry, and informational queries.
- relevance_score is 0.0–1.0 indicating how relevant the keyword is to the brand.
- Keep keywords natural and conversational (how people ask AI assistants).
- Avoid overly generic single words; prefer 2-5 word phrases.
- Return only valid JSON.
"""


class KeywordServiceError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class KeywordService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_keywords(
        self,
        project_id: UUID,
        tenant_id: UUID,
        category: str | None = None,
    ) -> list[KeywordResponse]:
        await self._verify_project(project_id, tenant_id)

        query = (
            select(Keyword)
            .where(Keyword.project_id == project_id)
            .order_by(
                Keyword.relevance_score.desc().nulls_last(), Keyword.created_at.desc()
            )
        )
        if category:
            query = query.where(Keyword.category == category)

        result = await self.db.scalars(query)
        return [KeywordResponse.model_validate(k) for k in result.all()]

    async def create_keyword(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: KeywordCreate,
    ) -> KeywordResponse:
        await self._verify_project(project_id, tenant_id)

        keyword = Keyword(
            keyword=data.keyword,
            category=data.category,
            search_volume=data.search_volume,
            relevance_score=data.relevance_score,
            is_selected=data.is_selected,
            project_id=project_id,
        )
        self.db.add(keyword)
        await self.db.commit()
        await self.db.refresh(keyword)
        return KeywordResponse.model_validate(keyword)

    async def bulk_create_keywords(
        self,
        project_id: UUID,
        tenant_id: UUID,
        data: KeywordBulkCreate,
    ) -> list[KeywordResponse]:
        await self._verify_project(project_id, tenant_id)

        keywords = []
        for item in data.keywords:
            kw = Keyword(
                keyword=item.keyword,
                category=item.category,
                search_volume=item.search_volume,
                relevance_score=item.relevance_score,
                is_selected=item.is_selected,
                project_id=project_id,
            )
            self.db.add(kw)
            keywords.append(kw)

        await self.db.commit()
        for kw in keywords:
            await self.db.refresh(kw)
        return [KeywordResponse.model_validate(kw) for kw in keywords]

    async def update_keyword(
        self,
        keyword_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
        data: KeywordUpdate,
    ) -> KeywordResponse | None:
        await self._verify_project(project_id, tenant_id)

        result = await self.db.execute(
            select(Keyword).where(
                Keyword.id == keyword_id,
                Keyword.project_id == project_id,
            )
        )
        keyword = result.scalar_one_or_none()
        if keyword is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(keyword, key, value)

        await self.db.commit()
        await self.db.refresh(keyword)
        return KeywordResponse.model_validate(keyword)

    async def delete_keyword(
        self,
        keyword_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        await self._verify_project(project_id, tenant_id)

        result = await self.db.execute(
            select(Keyword).where(
                Keyword.id == keyword_id,
                Keyword.project_id == project_id,
            )
        )
        keyword = result.scalar_one_or_none()
        if keyword is None:
            return False

        await self.db.delete(keyword)
        await self.db.commit()
        return True

    async def generate_keywords(
        self,
        project_id: UUID,
        tenant_id: UUID,
        ai_client: AIClient,
        max_keywords: int = 20,
        categories: list[str] | None = None,
    ) -> KeywordGenerateResponse:
        project = await self._verify_project(project_id, tenant_id)

        # Load brand context
        brand = await self.db.scalar(
            select(Brand).where(Brand.project_id == project_id)
        )
        if brand is None:
            raise KeywordServiceError(
                404,
                "brand.not_found",
                "Brand not found. Complete the brand setup first.",
            )

        knowledge_entries = list(
            (
                await self.db.scalars(
                    select(KnowledgeEntry)
                    .where(KnowledgeEntry.brand_id == brand.id)
                    .order_by(KnowledgeEntry.created_at.desc())
                    .limit(80)
                )
            ).all()
        )

        # Build prompt
        prompt = self._build_generation_prompt(
            brand=brand,
            knowledge_entries=knowledge_entries,
            max_keywords=max_keywords,
            categories=categories,
            content_locale=project.content_locale or "en",
        )

        response = await ai_client.complete(
            provider="openai",
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": KEYWORD_GENERATION_SYSTEM_PROMPT
                    + locale_instruction(project.content_locale or "en"),
                },
                {"role": "user", "content": prompt},
            ],
            request_type="keyword_generation",
            temperature=0.3,
            max_tokens=2048,
        )
        await self.db.commit()

        parsed = self._parse_json_payload(response.content)
        raw_keywords = self._extract_keywords(parsed, max_keywords)

        # Delete existing keywords and replace with new ones
        await self.db.execute(delete(Keyword).where(Keyword.project_id == project_id))

        keywords = []
        for item in raw_keywords:
            kw = Keyword(
                keyword=item["keyword"],
                category=item.get("category", "general"),
                relevance_score=item.get("relevance_score"),
                is_selected=True,
                project_id=project_id,
            )
            self.db.add(kw)
            keywords.append(kw)

        await self.db.commit()
        for kw in keywords:
            await self.db.refresh(kw)

        return KeywordGenerateResponse(
            keywords=[KeywordResponse.model_validate(kw) for kw in keywords],
            knowledge_entries_considered=len(knowledge_entries),
        )

    def _build_generation_prompt(
        self,
        brand: Brand,
        knowledge_entries: list[KnowledgeEntry],
        max_keywords: int,
        categories: list[str] | None,
        content_locale: str,
    ) -> str:
        sections = [
            f"Brand name: {brand.name}",
            f"Brand website: {brand.website or ''}",
            f"Brand description: {brand.description or ''}",
            f"Brand positioning: {brand.positioning or ''}",
            f"Industry: {brand.industry or ''}",
            f"Target audience: {brand.target_audience or ''}",
            f"Maximum keywords: {max_keywords}",
        ]
        if categories:
            sections.append(f"Focus on categories: {', '.join(categories)}")

        sections.append("")
        sections.append("Knowledge excerpts:")
        sections.append(self._format_knowledge(knowledge_entries, max_chars=12_000))
        sections.append("")
        sections.append("Return the JSON object now.")
        return "\n".join(sections)

    @staticmethod
    def _format_knowledge(entries: list[KnowledgeEntry], max_chars: int) -> str:
        chunks: list[str] = []
        total = 0
        for i, entry in enumerate(entries, 1):
            content = re.sub(r"\s+", " ", entry.content or "").strip()
            if not content:
                continue
            if len(content) > 400:
                content = content[:397] + "..."
            line = f"[{i}] type={entry.type} content={content}"
            if total + len(line) > max_chars:
                break
            chunks.append(line)
            total += len(line)
        return "\n".join(chunks)

    @staticmethod
    def _parse_json_payload(raw: str) -> Any:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        fenced = re.search(r"```(?:json)?\s*([\[{].*[\]}])\s*```", raw, re.DOTALL)
        if fenced:
            return json.loads(fenced.group(1))

        match = re.search(r"([\[{].*[\]}])", raw, re.DOTALL)
        if match:
            return json.loads(match.group(1))

        raise KeywordServiceError(
            502, "ai.invalid_json", "The AI provider returned invalid JSON."
        )

    @staticmethod
    def _extract_keywords(payload: Any, max_keywords: int) -> list[dict[str, Any]]:
        if isinstance(payload, dict):
            raw = payload.get("keywords", [])
        elif isinstance(payload, list):
            raw = payload
        else:
            raw = []

        results: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in raw:
            if not isinstance(item, dict):
                continue
            keyword = item.get("keyword", "").strip()
            if not keyword:
                continue
            normalized = keyword.lower()
            if normalized in seen:
                continue
            seen.add(normalized)

            score = item.get("relevance_score")
            if isinstance(score, (int, float)):
                score = max(0.0, min(1.0, float(score)))
            else:
                score = None

            results.append(
                {
                    "keyword": keyword,
                    "category": item.get("category", "general"),
                    "relevance_score": score,
                }
            )
            if len(results) >= max_keywords:
                break
        return results

    async def _verify_project(self, project_id: UUID, tenant_id: UUID) -> Project:
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.tenant_id == tenant_id,
            )
        )
        project = result.scalar_one_or_none()
        if project is None:
            raise KeywordServiceError(404, "project.not_found", "Project not found")
        return project
