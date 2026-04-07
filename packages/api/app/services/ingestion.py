"""Ingestion service — website crawling, LLM knowledge extraction, and embedding generation.

Orchestrates the full ingestion pipeline:
1. Crawl a brand's website using Crawl4AI
2. Extract structured knowledge from page content via LLM (AIClient)
3. Parse uploaded documents (PDF, DOCX, TXT)
4. Generate and store embeddings for all knowledge entries
5. Run the complete pipeline end-to-end
"""

from __future__ import annotations

import json
import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeEntry
from app.services.ai_client import AIClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM extraction settings
# ---------------------------------------------------------------------------

EXTRACTION_PROVIDER = "openai"
EXTRACTION_MODEL = "gpt-4o-mini"
EXTRACTION_MAX_TOKENS = 4096
CHUNK_SIZE = 4000  # Max chars per document chunk for LLM extraction

EXTRACTION_SYSTEM_PROMPT = """\
You are a knowledge extraction assistant for brand intelligence.
Given a web page's text content, extract structured facts about the brand, its products,
services, claims, testimonials, pricing, certifications, awards, and FAQs.

Return a JSON object with the following structure:
{
  "facts": [{"content": "...", "type": "fact"}],
  "products": [{"content": "...", "type": "product"}],
  "claims": [{"content": "...", "type": "claim"}],
  "testimonials": [{"content": "...", "type": "testimonial"}],
  "certifications": [{"content": "...", "type": "certification"}],
  "awards": [{"content": "...", "type": "award"}],
  "faqs": [{"content": "Q: ... A: ...", "type": "faq"}]
}

Rules:
- Each "content" field should be a clear, self-contained statement
- Skip boilerplate (navigation, footers, cookie notices)
- Combine related fragments into coherent entries
- If a category has no items, use an empty array
- Return ONLY valid JSON, no markdown or explanation"""

# Known categories in the extraction output
EXTRACTION_CATEGORIES = [
    "facts",
    "products",
    "claims",
    "testimonials",
    "certifications",
    "awards",
    "faqs",
]

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class CrawledPage:
    """A single crawled page result."""

    url: str
    title: str
    content: str
    status: str = "success"
    error: str | None = None


@dataclass
class CrawlResult:
    """Result of crawling a website."""

    pages: list[dict] = field(default_factory=list)
    total_pages: int = 0
    successful_pages: int = 0
    failed_pages: int = 0


@dataclass
class ExtractedEntry:
    """A single extracted knowledge entry."""

    content: str
    type: str
    source_url: str | None = None


@dataclass
class ExtractionResult:
    """Result of LLM knowledge extraction."""

    entries: list[dict] = field(default_factory=list)
    total_extracted: int = 0
    pages_processed: int = 0


@dataclass
class EmbeddingResult:
    """Result of embedding generation."""

    embedded_count: int = 0
    skipped_count: int = 0


@dataclass
class IngestionSummary:
    """Summary returned by the full ingestion pipeline."""

    pages_crawled: int = 0
    entries_created: int = 0
    embeddings_generated: int = 0
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class IngestionService:
    """Service for ingesting brand knowledge from websites and documents.

    Args:
        db: Async SQLAlchemy session for database operations.
        ai_client: Optional AIClient instance for LLM calls.  When provided,
            extraction requests are routed through the platform's AI proxy
            (with rate-limiting, key resolution, and usage tracking).
    """

    def __init__(
        self,
        db: AsyncSession,
        ai_client: AIClient | None = None,
    ):
        self.db = db
        self.ai_client = ai_client

    # ------------------------------------------------------------------
    # 1. Website Crawling
    # ------------------------------------------------------------------

    async def crawl_website(
        self,
        brand_id: UUID,
        url: str,
        max_depth: int = 3,
        max_pages: int = 50,
    ) -> dict:
        """Crawl a website and return page contents.

        Uses Crawl4AI's ``AsyncWebCrawler`` for recursive crawling with a
        configurable depth limit.  Internal links discovered on each page
        are queued up to ``max_depth`` levels and capped at ``max_pages``
        total pages.

        Args:
            brand_id: The brand this crawl is for (used for logging context).
            url: The starting URL to crawl.
            max_depth: Maximum link-follow depth (default 3).
            max_pages: Maximum number of pages to crawl (default 50).

        Returns:
            A dict with keys ``pages``, ``total_pages``,
            ``successful_pages``, ``failed_pages``.
        """
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

        pages: list[dict] = []
        visited: set[str] = set()
        to_visit: list[tuple[str, int]] = [(url, 0)]
        errors: list[str] = []

        browser_config = BrowserConfig(headless=True, verbose=False)

        logger.info(
            "Starting crawl for brand %s: url=%s max_depth=%d max_pages=%d",
            brand_id,
            url,
            max_depth,
            max_pages,
        )

        try:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                while to_visit and len(pages) < max_pages:
                    current_url, depth = to_visit.pop(0)

                    if current_url in visited:
                        continue
                    visited.add(current_url)

                    try:
                        run_config = CrawlerRunConfig(
                            page_timeout=30000,
                            wait_until="domcontentloaded",
                        )
                        result = await crawler.arun(
                            url=current_url, config=run_config
                        )

                        if result.success:
                            # Prefer markdown for clean text content
                            content = str(result.markdown) if result.markdown else ""
                            if not content and result.cleaned_html:
                                content = result.cleaned_html

                            page_data = {
                                "url": current_url,
                                "title": (
                                    result.metadata.get("title", "")
                                    if result.metadata
                                    else ""
                                ),
                                "content": content,
                                "status": "success",
                            }
                            pages.append(page_data)

                            # Queue internal links if within depth limit
                            if depth < max_depth and result.links:
                                internal_links = result.links.get("internal", [])
                                for link in internal_links:
                                    link_url = (
                                        link.get("href", "")
                                        if isinstance(link, dict)
                                        else str(link)
                                    )
                                    if link_url and link_url not in visited:
                                        to_visit.append((link_url, depth + 1))
                        else:
                            error_msg = result.error_message or "Unknown error"
                            pages.append(
                                {
                                    "url": current_url,
                                    "title": "",
                                    "content": "",
                                    "status": "failed",
                                    "error": error_msg,
                                }
                            )
                            errors.append(f"{current_url}: {error_msg}")

                    except Exception as e:
                        logger.warning("Failed to crawl %s: %s", current_url, e)
                        pages.append(
                            {
                                "url": current_url,
                                "title": "",
                                "content": "",
                                "status": "failed",
                                "error": str(e),
                            }
                        )
                        errors.append(f"{current_url}: {e}")

        except Exception as e:
            logger.error("Crawler initialization failed: %s", e)
            errors.append(f"Crawler init error: {e}")

        successful = sum(1 for p in pages if p.get("status") == "success")
        return {
            "pages": pages,
            "total_pages": len(pages),
            "successful_pages": successful,
            "failed_pages": len(pages) - successful,
            "errors": errors,
        }

    # ------------------------------------------------------------------
    # 2. LLM Extraction
    # ------------------------------------------------------------------

    async def extract_knowledge_from_text(
        self,
        brand_id: UUID,
        text: str,
        source_url: str | None = None,
    ) -> list[dict]:
        """Extract structured knowledge entries from text content using LLM.

        Sends the text to the configured LLM (via ``AIClient`` when available,
        or directly via the OpenAI API as a fallback) with a prompt that
        requests structured JSON output.  Each extracted item is classified
        as one of: fact, claim, testimonial, certification, award, product,
        or faq.

        Args:
            brand_id: The brand to associate entries with.
            text: The text content to extract knowledge from.
            source_url: Optional URL where the text was sourced.

        Returns:
            List of dicts with keys ``content``, ``type``, ``source_url``.
        """
        if not text or len(text.strip()) < 50:
            return []

        # Truncate very long content to fit context window
        max_chars = 30_000
        if len(text) > max_chars:
            text = text[:max_chars]

        messages = [
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Extract knowledge from this web page content:\n\n" + text
                ),
            },
        ]

        raw_content = await self._call_llm(messages)
        if raw_content is None:
            logger.warning(
                "LLM extraction returned None for brand %s, source_url=%s, text_length=%d",
                brand_id, source_url, len(text),
            )
            return []

        # Parse the JSON response
        try:
            extracted = json.loads(raw_content)
        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse LLM extraction as JSON for brand %s. Raw (first 500 chars): %s",
                brand_id, raw_content[:500],
            )
            return []

        entries: list[dict] = []
        for category in EXTRACTION_CATEGORIES:
            items = extracted.get(category, [])
            for item in items:
                entry_content = item.get("content", "")
                entry_type = item.get("type", category.rstrip("s"))
                if entry_content:
                    entries.append(
                        {
                            "content": entry_content,
                            "type": entry_type,
                            "source_url": source_url,
                        }
                    )

        # Persist to DB
        for entry_data in entries:
            entry = KnowledgeEntry(
                type=entry_data["type"],
                content=entry_data["content"],
                source_url=entry_data.get("source_url"),
                brand_id=brand_id,
                version=1,
            )
            self.db.add(entry)

        if entries:
            await self.db.commit()

        return entries

    # ------------------------------------------------------------------
    # 3. Document Processing
    # ------------------------------------------------------------------

    async def process_document(
        self,
        brand_id: UUID,
        file_bytes: bytes,
        filename: str,
    ) -> list[dict]:
        """Parse a document and extract knowledge entries from its content.

        Writes the raw bytes to a temporary file, invokes the appropriate
        parser (PDF, DOCX, or TXT via ``document_parser``), splits the
        resulting text into chunks of up to 4 000 characters, and runs
        LLM extraction on each chunk.

        Args:
            brand_id: The brand to associate extracted entries with.
            file_bytes: Raw bytes of the uploaded file.
            filename: Original filename (used to determine parser via extension).

        Returns:
            Aggregated list of extracted entry dicts across all chunks.

        Raises:
            ValueError: If the file extension is not supported by the parser.
        """
        from app.utils.document_parser import parse_document

        # Write bytes to a temporary file so the parser can read it
        suffix = Path(filename).suffix
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            text = parse_document(tmp_path)
        finally:
            # Clean up the temp file
            Path(tmp_path).unlink(missing_ok=True)

        if not text or not text.strip():
            logger.info("Document %s yielded no text content", filename)
            return []

        # Split into chunks if the text is too long
        chunks = self._split_text(text, chunk_size=CHUNK_SIZE)

        all_entries: list[dict] = []
        for chunk in chunks:
            chunk_entries = await self.extract_knowledge_from_text(
                brand_id=brand_id,
                text=chunk,
                source_url=None,
            )
            all_entries.extend(chunk_entries)

        logger.info(
            "Document %s: %d chunks processed, %d entries extracted",
            filename,
            len(chunks),
            len(all_entries),
        )
        return all_entries

    # ------------------------------------------------------------------
    # 4. Full Ingestion Pipeline
    # ------------------------------------------------------------------

    async def run_full_ingestion(
        self,
        brand_id: UUID,
        url: str,
        max_depth: int = 3,
    ) -> dict:
        """Run the complete ingestion pipeline for a brand's website.

        Orchestrates all stages in sequence:
        1. Crawl the website to collect page content.
        2. Extract structured knowledge from every successfully crawled page.
        3. Generate embeddings for all newly created entries.
        4. Persist everything to the database.

        Args:
            brand_id: The brand to ingest knowledge for.
            url: The starting URL to crawl.
            max_depth: Maximum crawl depth (default 3).

        Returns:
            A summary dict with keys ``pages_crawled``, ``entries_created``,
            ``embeddings_generated``, and ``errors``.
        """
        errors: list[str] = []

        # --- Step 1: Crawl ---
        logger.info("Ingestion pipeline started for brand %s: %s", brand_id, url)
        crawl_result = await self.crawl_website(
            brand_id=brand_id,
            url=url,
            max_depth=max_depth,
        )
        pages_crawled = crawl_result["successful_pages"]
        errors.extend(crawl_result.get("errors", []))

        # --- Step 2: Extract knowledge from each successful page ---
        total_entries = 0
        for page in crawl_result["pages"]:
            if page.get("status") != "success":
                continue
            content = page.get("content", "")
            if not content:
                continue

            try:
                entries = await self.extract_knowledge_from_text(
                    brand_id=brand_id,
                    text=content,
                    source_url=page.get("url"),
                )
                total_entries += len(entries)
            except Exception as e:
                page_url = page.get("url", "unknown")
                logger.warning("Extraction failed for %s: %s", page_url, e)
                errors.append(f"Extraction error on {page_url}: {e}")

        # --- Step 3: Generate embeddings ---
        embeddings_generated = 0
        try:
            embeddings_generated = await self.generate_embeddings_for_brand(brand_id)
        except Exception as e:
            logger.warning("Embedding generation failed for brand %s: %s", brand_id, e)
            errors.append(f"Embedding error: {e}")

        summary = {
            "pages_crawled": pages_crawled,
            "entries_created": total_entries,
            "embeddings_generated": embeddings_generated,
            "errors": errors,
        }
        logger.info("Ingestion pipeline completed for brand %s: %s", brand_id, summary)
        return summary

    # ------------------------------------------------------------------
    # 5. Embedding Generation
    # ------------------------------------------------------------------

    async def generate_embeddings_for_brand(self, brand_id: UUID) -> int:
        """Generate embeddings for all knowledge entries of a brand that lack them.

        Fetches every ``KnowledgeEntry`` for the given brand where
        ``embedding IS NULL``, batch-generates embeddings via the OpenAI
        ``text-embedding-3-large`` model, updates each entry, and commits.

        Args:
            brand_id: The brand whose entries need embeddings.

        Returns:
            The number of entries that were successfully embedded.
        """
        from app.utils.embeddings import generate_embeddings

        # Fetch entries without embeddings
        result = await self.db.execute(
            select(KnowledgeEntry).where(
                KnowledgeEntry.brand_id == brand_id,
                KnowledgeEntry.embedding.is_(None),
            )
        )
        entries = list(result.scalars().all())

        if not entries:
            return 0

        to_embed_texts: list[str] = []
        to_embed_entries: list[KnowledgeEntry] = []

        for entry in entries:
            if entry.content and entry.content.strip():
                to_embed_texts.append(entry.content)
                to_embed_entries.append(entry)

        if not to_embed_texts:
            return 0

        logger.info(
            "Generating embeddings for %d entries (brand %s)",
            len(to_embed_texts),
            brand_id,
        )

        embeddings = await generate_embeddings(to_embed_texts)

        for entry, embedding in zip(to_embed_entries, embeddings):
            entry.embedding = embedding

        await self.db.commit()

        return len(to_embed_entries)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _call_llm(self, messages: list[dict]) -> str | None:
        """Send messages to the LLM and return the text response.

        Uses the platform ``AIClient`` when one was provided at construction
        time (giving full rate-limiting, key resolution, and usage tracking).
        Falls back to a direct OpenAI API call otherwise.

        Returns:
            The assistant message text, or ``None`` on failure.
        """
        if self.ai_client is not None:
            return await self._call_llm_via_ai_client(messages)
        return await self._call_llm_direct(messages)

    async def _call_llm_via_ai_client(self, messages: list[dict]) -> str | None:
        """Route the LLM call through the platform's AIClient."""
        try:
            response = await self.ai_client.complete(
                provider=EXTRACTION_PROVIDER,
                model=EXTRACTION_MODEL,
                messages=messages,
                request_type="knowledge_extraction",
                temperature=0.1,
                max_tokens=EXTRACTION_MAX_TOKENS,
            )
            return response.content
        except Exception as e:
            logger.warning("AIClient extraction call failed: %s", e)
            return None

    async def _call_llm_direct(self, messages: list[dict]) -> str | None:
        """Call the OpenAI API directly (fallback when no AIClient)."""
        import os

        import httpx

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": EXTRACTION_MODEL,
                        "messages": messages,
                        "max_tokens": EXTRACTION_MAX_TOKENS,
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"},
                    },
                )
                resp.raise_for_status()

            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning("Direct OpenAI extraction call failed: %s", e)
            return None

    @staticmethod
    def _split_text(text: str, chunk_size: int = CHUNK_SIZE) -> list[str]:
        """Split text into chunks of approximately ``chunk_size`` characters.

        Tries to break on paragraph boundaries (double newline) to keep
        chunks semantically coherent.  Falls back to hard splitting when a
        single paragraph exceeds the limit.
        """
        if len(text) <= chunk_size:
            return [text]

        chunks: list[str] = []
        paragraphs = text.split("\n\n")
        current_chunk = ""

        for paragraph in paragraphs:
            # If adding this paragraph would exceed the limit, flush current chunk
            if current_chunk and len(current_chunk) + len(paragraph) + 2 > chunk_size:
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # If a single paragraph exceeds chunk_size, hard-split it
            if len(paragraph) > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                for i in range(0, len(paragraph), chunk_size):
                    chunks.append(paragraph[i : i + chunk_size].strip())
            else:
                if current_chunk:
                    current_chunk += "\n\n"
                current_chunk += paragraph

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return [c for c in chunks if c]
