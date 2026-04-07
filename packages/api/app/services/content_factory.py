"""Content Factory service — template-driven AI content generation.

Strictly grounds generated content in the brand's knowledge pack.
Produces JSON-LD (Schema.org) markup alongside the content body.
"""

import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.models.content import Content
from app.models.content_template import ContentTemplate
from app.models.knowledge import KnowledgeEntry
from app.models.project import Project
from app.utils.locale import locale_instruction
from app.schemas.content_template import (
    ContentTemplateCreate,
    ContentTemplateResponse,
    ContentTemplateUpdate,
)
from app.services.ai_client import AIClient, AIResponse
from app.utils.embeddings import generate_embedding

logger = logging.getLogger(__name__)


def _template_response(t: ContentTemplate) -> ContentTemplateResponse:
    return ContentTemplateResponse(
        id=t.id,
        name=t.name,
        content_type=t.content_type,
        template_prompt=t.template_prompt,
        structure_schema=t.structure_schema,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


class ContentFactoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Template CRUD
    # ------------------------------------------------------------------

    async def list_templates(
        self, content_type: str | None = None
    ) -> list[ContentTemplateResponse]:
        query = select(ContentTemplate).order_by(ContentTemplate.created_at)
        if content_type:
            query = query.where(ContentTemplate.content_type == content_type)

        result = await self.db.execute(query)
        templates = result.scalars().all()
        return [_template_response(t) for t in templates]

    async def get_template(
        self, template_id: UUID
    ) -> ContentTemplateResponse | None:
        result = await self.db.execute(
            select(ContentTemplate).where(ContentTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        if template is None:
            return None
        return _template_response(template)

    async def get_default_template_id_for_content_type(
        self,
        content_type: str,
    ) -> UUID | None:
        """Return the oldest template for a content type as the default choice."""
        result = await self.db.execute(
            select(ContentTemplate.id)
            .where(ContentTemplate.content_type == content_type)
            .order_by(ContentTemplate.created_at.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_template(
        self, data: ContentTemplateCreate
    ) -> ContentTemplateResponse:
        template = ContentTemplate(
            name=data.name,
            content_type=data.content_type,
            template_prompt=data.template_prompt,
            structure_schema=data.structure_schema,
        )
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return _template_response(template)

    async def update_template(
        self, template_id: UUID, data: ContentTemplateUpdate
    ) -> ContentTemplateResponse | None:
        result = await self.db.execute(
            select(ContentTemplate).where(ContentTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        if template is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(template, key, value)

        await self.db.commit()
        await self.db.refresh(template)
        return _template_response(template)

    async def delete_template(self, template_id: UUID) -> bool:
        result = await self.db.execute(
            select(ContentTemplate).where(ContentTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        if template is None:
            return False

        await self.db.delete(template)
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Content Generation
    # ------------------------------------------------------------------

    async def generate_content(
        self,
        ai_client: AIClient,
        template_id: UUID,
        project_id: UUID,
        tenant_id: UUID,
        author_id: UUID,
        topic: str,
        extra_context: str | None = None,
    ) -> Content | None:
        """Generate content using a template, grounded in the knowledge pack.

        Returns the created Content record in draft status, or None if
        the template or project/brand cannot be found.
        """
        # 1. Load template
        tmpl_result = await self.db.execute(
            select(ContentTemplate).where(ContentTemplate.id == template_id)
        )
        template = tmpl_result.scalar_one_or_none()
        if template is None:
            return None

        # 2. Load brand for the project (verifying tenant ownership)
        brand = await self._get_brand(project_id, tenant_id)
        if brand is None:
            return None

        # 2b. Load project locale
        project = await self.db.scalar(
            select(Project).where(Project.id == project_id)
        )
        content_locale = project.content_locale if project else "en"

        # 3. Retrieve relevant knowledge entries via semantic search
        knowledge_text = await self._retrieve_knowledge(brand.id, topic)

        # 4. Build prompts
        brand_voice = brand.voice_guidelines or "Professional and clear"
        system_prompt = self._build_system_prompt(
            template.template_prompt,
            knowledge_text,
            brand.name,
            brand_voice,
        ) + locale_instruction(content_locale)
        user_prompt = f"Generate {template.content_type} content about: {topic}"
        if extra_context:
            user_prompt += f"\n\nAdditional context: {extra_context}"

        # 5. Call LLM
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response: AIResponse = await ai_client.complete(
            provider="openai",
            model="gpt-4o",
            messages=messages,
            request_type="content_generation",
            temperature=0.4,
            max_tokens=4096,
        )

        generated_body = response.content

        # 6. Derive a title from the first line or the topic
        title = self._extract_title(generated_body, topic)

        # 7. Generate JSON-LD
        json_ld = self.generate_json_ld(
            content_type=template.content_type,
            title=title,
            body=generated_body,
            brand=brand,
        )

        # 8. Create Content record
        content = Content(
            title=title,
            body=generated_body,
            content_type=template.content_type,
            status="draft",
            project_id=project_id,
            author_id=author_id,
            template_id=template.id,
            json_ld=json_ld,
        )
        self.db.add(content)
        await self.db.commit()
        await self.db.refresh(content, attribute_names=["author"])

        return content

    # ------------------------------------------------------------------
    # JSON-LD Generation
    # ------------------------------------------------------------------

    def generate_json_ld(
        self,
        content_type: str,
        title: str,
        body: str,
        brand: Brand,
    ) -> str:
        """Generate a JSON-LD Schema.org snippet based on content type."""
        now_iso = datetime.now(timezone.utc).isoformat()

        if content_type == "faq":
            schema = self._faq_schema(title, body, brand)
        elif content_type == "blog":
            schema = self._article_schema(title, body, brand, now_iso)
        elif content_type == "comparison":
            schema = self._comparison_schema(title, body, brand)
        elif content_type == "buyer_guide":
            schema = self._buyer_guide_schema(title, body, brand, now_iso)
        elif content_type == "pricing_clarifier":
            schema = self._pricing_schema(title, body, brand)
        elif content_type == "glossary":
            schema = self._glossary_schema(title, body, brand)
        else:
            # Fallback: generic Article schema
            schema = self._article_schema(title, body, brand, now_iso)

        return json.dumps(schema, indent=2, ensure_ascii=False)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_system_prompt(
        template_prompt: str,
        knowledge_text: str,
        brand_name: str,
        brand_voice: str,
    ) -> str:
        return (
            f"{template_prompt}\n\n"
            "IMPORTANT: You MUST only use facts from the following knowledge base. "
            "Do not add any information not present in these facts. "
            "Do not hallucinate or make up claims.\n\n"
            f"Knowledge Base:\n{knowledge_text}\n\n"
            f"Brand: {brand_name}\n"
            f"Brand Voice: {brand_voice}"
        )

    async def _retrieve_knowledge(
        self, brand_id: UUID, topic: str, limit: int = 20
    ) -> str:
        """Retrieve relevant knowledge entries for the topic.

        Tries semantic search first (requires embeddings). Falls back to
        fetching the most recent entries if no embeddings are available.
        """
        entries: list[KnowledgeEntry] = []

        try:
            query_embedding = await generate_embedding(topic)
            result = await self.db.execute(
                select(KnowledgeEntry)
                .where(
                    KnowledgeEntry.brand_id == brand_id,
                    KnowledgeEntry.embedding.isnot(None),
                )
                .order_by(
                    KnowledgeEntry.embedding.cosine_distance(query_embedding)
                )
                .limit(limit)
            )
            entries = list(result.scalars().all())
        except Exception:
            logger.warning(
                "Semantic search failed for brand %s, falling back to recent entries",
                brand_id,
            )

        # Fallback: if no entries with embeddings, just grab the latest ones
        if not entries:
            result = await self.db.execute(
                select(KnowledgeEntry)
                .where(KnowledgeEntry.brand_id == brand_id)
                .order_by(KnowledgeEntry.created_at.desc())
                .limit(limit)
            )
            entries = list(result.scalars().all())

        if not entries:
            return "(No knowledge entries available for this brand.)"

        lines: list[str] = []
        for i, entry in enumerate(entries, 1):
            source = f" (source: {entry.source_url})" if entry.source_url else ""
            lines.append(f"{i}. [{entry.type}] {entry.content}{source}")

        return "\n".join(lines)

    async def _get_brand(
        self, project_id: UUID, tenant_id: UUID
    ) -> Brand | None:
        """Fetch the brand for a project, verifying tenant ownership."""
        project_result = await self.db.execute(
            select(Project).where(
                Project.id == project_id, Project.tenant_id == tenant_id
            )
        )
        if project_result.scalar_one_or_none() is None:
            return None

        result = await self.db.execute(
            select(Brand).where(Brand.project_id == project_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _extract_title(body: str, fallback_topic: str) -> str:
        """Extract a title from the generated body text.

        Looks for a markdown heading on the first line, otherwise uses
        the topic as the title.
        """
        first_line = body.strip().split("\n")[0].strip()
        # Remove leading markdown heading markers
        if first_line.startswith("#"):
            title = first_line.lstrip("#").strip()
            if title:
                return title[:512]
        return fallback_topic[:512]

    # --- Schema.org builders ---

    @staticmethod
    def _faq_schema(title: str, body: str, brand: Brand) -> dict:
        """Build FAQPage schema from Q&A pairs in the body."""
        qa_pairs: list[dict] = []
        current_q: str | None = None
        current_a_lines: list[str] = []

        for line in body.split("\n"):
            stripped = line.strip()
            # Detect questions: lines starting with Q: or **Q or ## or bold
            if (
                stripped.lower().startswith("q:")
                or stripped.startswith("**Q")
                or (stripped.startswith("##") and "?" in stripped)
            ):
                # Save previous Q&A
                if current_q and current_a_lines:
                    qa_pairs.append({
                        "@type": "Question",
                        "name": current_q,
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": " ".join(current_a_lines).strip(),
                        },
                    })
                current_q = (
                    stripped.lstrip("#*Qq: ").strip().rstrip("*").strip()
                )
                current_a_lines = []
            elif stripped.lower().startswith("a:") or (
                current_q and stripped and not stripped.startswith("#")
            ):
                clean = stripped.lstrip("Aa: ").strip().rstrip("*").strip()
                if clean:
                    current_a_lines.append(clean)

        # Last pair
        if current_q and current_a_lines:
            qa_pairs.append({
                "@type": "Question",
                "name": current_q,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": " ".join(current_a_lines).strip(),
                },
            })

        # Fallback if parsing didn't find Q&A pairs
        if not qa_pairs:
            qa_pairs.append({
                "@type": "Question",
                "name": title,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": body[:500],
                },
            })

        return {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "name": title,
            "mainEntity": qa_pairs,
        }

    @staticmethod
    def _article_schema(
        title: str, body: str, brand: Brand, date_iso: str
    ) -> dict:
        return {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title[:110],
            "author": {
                "@type": "Organization",
                "name": brand.name,
                "url": brand.website or "",
            },
            "datePublished": date_iso,
            "dateModified": date_iso,
            "description": body[:300].replace("\n", " "),
            "publisher": {
                "@type": "Organization",
                "name": brand.name,
            },
        }

    @staticmethod
    def _comparison_schema(title: str, body: str, brand: Brand) -> dict:
        """Build ItemList with Product items for comparison content."""
        items: list[dict] = []
        # Try to extract product mentions from body sections
        sections = body.split("\n\n")
        position = 1
        for section in sections:
            first_line = section.strip().split("\n")[0].strip().lstrip("#* ").strip()
            if first_line and len(first_line) < 200:
                items.append({
                    "@type": "ListItem",
                    "position": position,
                    "item": {
                        "@type": "Product",
                        "name": first_line[:200],
                        "description": section.strip()[:300],
                    },
                })
                position += 1
            if position > 10:
                break

        if not items:
            items.append({
                "@type": "ListItem",
                "position": 1,
                "item": {
                    "@type": "Product",
                    "name": brand.name,
                    "description": body[:300],
                },
            })

        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": title,
            "numberOfItems": len(items),
            "itemListElement": items,
        }

    @staticmethod
    def _buyer_guide_schema(
        title: str, body: str, brand: Brand, date_iso: str
    ) -> dict:
        """Article + HowTo hybrid schema for buyer guides."""
        steps: list[dict] = []
        step_num = 1
        for line in body.split("\n"):
            stripped = line.strip()
            # Detect numbered steps or heading-level steps
            if (
                stripped
                and len(stripped) < 300
                and (
                    stripped[0].isdigit()
                    or stripped.startswith("##")
                    or stripped.startswith("- **")
                )
            ):
                step_text = stripped.lstrip("#-*0123456789.) ").strip()
                if step_text:
                    steps.append({
                        "@type": "HowToStep",
                        "position": step_num,
                        "name": step_text[:200],
                    })
                    step_num += 1
            if step_num > 20:
                break

        return {
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": title,
            "description": body[:300].replace("\n", " "),
            "datePublished": date_iso,
            "author": {
                "@type": "Organization",
                "name": brand.name,
            },
            "step": steps if steps else [{
                "@type": "HowToStep",
                "position": 1,
                "name": title,
                "text": body[:500],
            }],
        }

    @staticmethod
    def _pricing_schema(title: str, body: str, brand: Brand) -> dict:
        return {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": title,
            "brand": {
                "@type": "Brand",
                "name": brand.name,
            },
            "description": body[:300].replace("\n", " "),
            "offers": {
                "@type": "AggregateOffer",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock",
                "url": brand.website or "",
            },
        }

    @staticmethod
    def _glossary_schema(title: str, body: str, brand: Brand) -> dict:
        """Build DefinedTermSet schema for glossary content."""
        terms: list[dict] = []
        current_term: str | None = None
        current_def_lines: list[str] = []

        for line in body.split("\n"):
            stripped = line.strip()
            # Detect term headings
            if stripped.startswith("##") or stripped.startswith("**"):
                if current_term and current_def_lines:
                    terms.append({
                        "@type": "DefinedTerm",
                        "name": current_term,
                        "description": " ".join(current_def_lines).strip(),
                    })
                current_term = stripped.lstrip("#* ").rstrip("*: ").strip()
                current_def_lines = []
            elif stripped and current_term:
                current_def_lines.append(stripped)

        if current_term and current_def_lines:
            terms.append({
                "@type": "DefinedTerm",
                "name": current_term,
                "description": " ".join(current_def_lines).strip(),
            })

        if not terms:
            terms.append({
                "@type": "DefinedTerm",
                "name": title,
                "description": body[:500],
            })

        return {
            "@context": "https://schema.org",
            "@type": "DefinedTermSet",
            "name": title,
            "hasDefinedTerm": terms,
        }
