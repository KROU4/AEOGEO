"""Temporal activity implementations for the AEOGEO pipeline.

Activities are the actual units of work executed by the Temporal worker.
Each activity is an async function decorated with @activity.defn.

Activities defined here:
- crawl_engine_activity  — Crawl an AI engine (ChatGPT, Gemini, etc.) with a query
- parse_answers_activity — Parse and structure raw engine responses
- score_run_activity     — Compute visibility scores for a set of parsed answers
- ingest_document_activity — Parse and embed a document for the knowledge base
- crawl_website_activity — Crawl a brand's website via Crawl4AI
- extract_knowledge_activity — Extract structured knowledge from crawled pages via LLM
- generate_embeddings_activity — Generate embeddings for brand knowledge entries
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from temporalio import activity
from temporalio.exceptions import ApplicationError

from app.crawl_availability import CrawlStackUnavailableError
from app.dependencies import async_session


# ---------------------------------------------------------------------------
# Ingestion activity dataclasses (Temporal requires serializable types)
# ---------------------------------------------------------------------------


@dataclass
class CrawlInput:
    """Input for crawl_website_activity."""

    brand_id: str
    url: str
    max_depth: int = 3
    max_pages: int = 50


@dataclass
class CrawlOutput:
    """Output from crawl_website_activity."""

    pages: list[dict] = field(default_factory=list)
    total_pages: int = 0
    successful_pages: int = 0
    failed_pages: int = 0


@dataclass
class ExtractionInput:
    """Input for extract_knowledge_activity."""

    brand_id: str
    pages: list[dict] = field(default_factory=list)


@dataclass
class ExtractionOutput:
    """Output from extract_knowledge_activity."""

    entries: list[dict] = field(default_factory=list)
    total_extracted: int = 0
    pages_processed: int = 0


@dataclass
class EmbeddingInput:
    """Input for generate_embeddings_activity."""

    brand_id: str


@dataclass
class EmbeddingOutput:
    """Output from generate_embeddings_activity."""

    embedded_count: int = 0
    skipped_count: int = 0


# ---------------------------------------------------------------------------
# Existing stub activities (visibility pipeline)
# ---------------------------------------------------------------------------


@activity.defn
async def crawl_engine_activity(engine: str, query: str) -> dict:
    """Crawl a single AI engine with the given query and return the raw response.

    TODO: Integrate crawl4ai to query the specified engine and capture the response.
    """
    activity.logger.info("crawl_engine_activity: engine=%s query=%s", engine, query)
    raise NotImplementedError("crawl_engine_activity not yet implemented")


@activity.defn
async def parse_answers_activity(run_id: str) -> dict:
    """Parse all answers for an engine run into structured mention/citation data.

    Delegates to ParseRunnerService which handles LLM extraction and Redis caching.
    This activity is kept for backward compatibility; new code should prefer
    parse_run_answers_activity from app.workflows.parse_answers.
    """
    activity.logger.info("parse_answers_activity: run_id=%s", run_id)

    from redis.asyncio import Redis

    from app.config import Settings
    from app.services.parse_runner import ParseRunnerService

    settings = Settings()

    async with async_session() as db:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            service = ParseRunnerService(db=db, redis=redis)
            result = await service.parse_run_answers(run_id=UUID(run_id))
            return result
        finally:
            await redis.aclose()


@activity.defn
async def score_run_activity(run_id: str) -> dict:
    """Compute visibility scores for a completed pipeline run.

    Delegates to ScoringService which computes 6-dimension sub-scores
    for each unscored answer and persists VisibilityScore records.
    """
    activity.logger.info("score_run_activity: run_id=%s", run_id)

    from app.services.scoring import ScoringService

    async with async_session() as db:
        service = ScoringService(db=db)
        result = await service.score_run(run_id=UUID(run_id))
        return result


@activity.defn
async def ingest_document_activity(document_path: str, tenant_id: str) -> dict:
    """Parse a document, chunk it, generate embeddings, and store in pgvector.

    TODO: Use document_parser + embeddings util to process and store the document.
    """
    activity.logger.info("ingest_document_activity: path=%s tenant=%s", document_path, tenant_id)
    raise NotImplementedError("ingest_document_activity not yet implemented")


# ---------------------------------------------------------------------------
# Ingestion pipeline activities
# ---------------------------------------------------------------------------


@activity.defn
async def crawl_website_activity(input: CrawlInput) -> CrawlOutput:
    """Crawl a brand's website using Crawl4AI.

    Creates its own DB session (activities run outside FastAPI request lifecycle)
    and delegates to IngestionService.crawl_website.
    """
    activity.logger.info(
        "crawl_website_activity: url=%s max_depth=%d max_pages=%d",
        input.url,
        input.max_depth,
        input.max_pages,
    )

    async with async_session() as db:
        from app.services.ingestion import IngestionService

        service = IngestionService(db)
        try:
            result = await service.crawl_website(
                brand_id=UUID(input.brand_id),
                url=input.url,
                max_depth=input.max_depth,
                max_pages=input.max_pages,
            )
        except CrawlStackUnavailableError as e:
            raise ApplicationError(str(e), non_retryable=True) from e

    return CrawlOutput(
        pages=result["pages"],
        total_pages=result["total_pages"],
        successful_pages=result["successful_pages"],
        failed_pages=result["failed_pages"],
    )


@activity.defn
async def extract_knowledge_activity(input: ExtractionInput) -> ExtractionOutput:
    """Extract structured knowledge from crawled page content via LLM.

    Iterates over each page, calls IngestionService.extract_knowledge_from_text,
    and collects all extracted entries.
    """
    activity.logger.info(
        "extract_knowledge_activity: brand_id=%s pages=%d",
        input.brand_id,
        len(input.pages),
    )

    brand_id = UUID(input.brand_id)
    all_entries: list[dict] = []
    pages_processed = 0

    async with async_session() as db:
        from app.services.ingestion import IngestionService

        service = IngestionService(db)

        for page in input.pages:
            content = page.get("content", "")
            source_url = page.get("url")

            if not content or len(content.strip()) < 50:
                activity.logger.debug("Skipping page %s: insufficient content", source_url)
                continue

            try:
                entries = await service.extract_knowledge_from_text(
                    brand_id=brand_id,
                    text=content,
                    source_url=source_url,
                )
                all_entries.extend(entries)
                pages_processed += 1
                activity.logger.info(
                    "Extracted %d entries from %s", len(entries), source_url
                )
            except Exception as e:
                activity.logger.warning(
                    "Failed to extract knowledge from %s: %s", source_url, e
                )
                # Continue processing other pages rather than failing entirely
                continue

            # Heartbeat after each page to signal liveness on long-running extractions
            activity.heartbeat(f"Processed {pages_processed} pages")

    return ExtractionOutput(
        entries=all_entries,
        total_extracted=len(all_entries),
        pages_processed=pages_processed,
    )


@activity.defn
async def generate_embeddings_activity(input: EmbeddingInput) -> EmbeddingOutput:
    """Generate embeddings for all knowledge entries of a brand that lack them.

    Calls IngestionService.generate_embeddings_for_brand to batch-embed
    entries via OpenAI text-embedding-3-large and store vectors in pgvector.
    """
    activity.logger.info(
        "generate_embeddings_activity: brand_id=%s", input.brand_id
    )

    brand_id = UUID(input.brand_id)

    async with async_session() as db:
        from app.services.ingestion import IngestionService

        service = IngestionService(db)
        result = await service.generate_embeddings_for_brand(brand_id)

    return EmbeddingOutput(
        embedded_count=result.embedded_count,
        skipped_count=result.skipped_count,
    )
