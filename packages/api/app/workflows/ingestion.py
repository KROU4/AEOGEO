"""Workflow: Knowledge ingestion pipeline.

Orchestrates website crawling, LLM knowledge extraction, and embedding
generation as a Temporal workflow with three sequential activities.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.workflows.activities import (
        CrawlInput,
        CrawlOutput,
        EmbeddingInput,
        EmbeddingOutput,
        ExtractionInput,
        ExtractionOutput,
        crawl_website_activity,
        extract_knowledge_activity,
        generate_embeddings_activity,
    )


@dataclass
class IngestionInput:
    """Input for the IngestionWorkflow."""

    brand_id: str
    url: str
    max_depth: int = 3
    max_pages: int = 50


@dataclass
class IngestionResult:
    """Result of the full ingestion pipeline."""

    total_pages_crawled: int = 0
    successful_pages: int = 0
    failed_pages: int = 0
    total_entries_extracted: int = 0
    pages_processed: int = 0
    entries_embedded: int = 0
    entries_skipped: int = 0
    status: str = "completed"
    error: str | None = None


@workflow.defn
class IngestionWorkflow:
    """Ingest knowledge from a brand's website into the knowledge base.

    Pipeline:
    1. Crawl the website using Crawl4AI (recursive, depth-limited)
    2. Extract structured knowledge from each crawled page via LLM
    3. Generate embeddings for all new knowledge entries via OpenAI

    Each step is a separate Temporal activity with its own retry policy
    and timeout, allowing independent failure handling and retries.
    """

    @workflow.run
    async def run(self, input: IngestionInput) -> IngestionResult:
        workflow.logger.info(
            "Starting ingestion for brand=%s url=%s max_depth=%d",
            input.brand_id,
            input.url,
            input.max_depth,
        )

        # ----------------------------------------------------------------
        # Activity 1: Crawl the website
        # ----------------------------------------------------------------
        try:
            crawl_result: CrawlOutput = await workflow.execute_activity(
                crawl_website_activity,
                CrawlInput(
                    brand_id=input.brand_id,
                    url=input.url,
                    max_depth=input.max_depth,
                    max_pages=input.max_pages,
                ),
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(minutes=1),
                    maximum_attempts=3,
                    backoff_coefficient=2.0,
                ),
            )
        except Exception as e:
            workflow.logger.error("Crawl activity failed: %s", e)
            return IngestionResult(
                status="failed",
                error=f"Crawl failed: {e}",
            )

        workflow.logger.info(
            "Crawl completed: %d pages (%d successful, %d failed)",
            crawl_result.total_pages,
            crawl_result.successful_pages,
            crawl_result.failed_pages,
        )

        if crawl_result.successful_pages == 0:
            return IngestionResult(
                total_pages_crawled=crawl_result.total_pages,
                successful_pages=0,
                failed_pages=crawl_result.failed_pages,
                status="failed",
                error="No pages were successfully crawled",
            )

        # ----------------------------------------------------------------
        # Activity 2: Extract knowledge from crawled content
        # ----------------------------------------------------------------
        # Filter to only successful pages with content
        successful_pages = [
            p for p in crawl_result.pages
            if p.get("status") == "success" and p.get("content")
        ]

        try:
            extraction_result: ExtractionOutput = await workflow.execute_activity(
                extract_knowledge_activity,
                ExtractionInput(
                    brand_id=input.brand_id,
                    pages=successful_pages,
                ),
                start_to_close_timeout=timedelta(minutes=15),
                heartbeat_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=10),
                    maximum_interval=timedelta(minutes=2),
                    maximum_attempts=2,
                    backoff_coefficient=2.0,
                ),
            )
        except Exception as e:
            workflow.logger.error("Extraction activity failed: %s", e)
            return IngestionResult(
                total_pages_crawled=crawl_result.total_pages,
                successful_pages=crawl_result.successful_pages,
                failed_pages=crawl_result.failed_pages,
                status="failed",
                error=f"Knowledge extraction failed: {e}",
            )

        workflow.logger.info(
            "Extraction completed: %d entries from %d pages",
            extraction_result.total_extracted,
            extraction_result.pages_processed,
        )

        if extraction_result.total_extracted == 0:
            return IngestionResult(
                total_pages_crawled=crawl_result.total_pages,
                successful_pages=crawl_result.successful_pages,
                failed_pages=crawl_result.failed_pages,
                total_entries_extracted=0,
                pages_processed=extraction_result.pages_processed,
                status="completed",
            )

        # ----------------------------------------------------------------
        # Activity 3: Generate embeddings for new entries
        # ----------------------------------------------------------------
        try:
            embedding_result: EmbeddingOutput = await workflow.execute_activity(
                generate_embeddings_activity,
                EmbeddingInput(brand_id=input.brand_id),
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    maximum_interval=timedelta(minutes=1),
                    maximum_attempts=3,
                    backoff_coefficient=2.0,
                ),
            )
        except Exception as e:
            workflow.logger.error("Embedding activity failed: %s", e)
            return IngestionResult(
                total_pages_crawled=crawl_result.total_pages,
                successful_pages=crawl_result.successful_pages,
                failed_pages=crawl_result.failed_pages,
                total_entries_extracted=extraction_result.total_extracted,
                pages_processed=extraction_result.pages_processed,
                status="partial",
                error=f"Embedding generation failed: {e}",
            )

        workflow.logger.info(
            "Embeddings completed: %d embedded, %d skipped",
            embedding_result.embedded_count,
            embedding_result.skipped_count,
        )

        return IngestionResult(
            total_pages_crawled=crawl_result.total_pages,
            successful_pages=crawl_result.successful_pages,
            failed_pages=crawl_result.failed_pages,
            total_entries_extracted=extraction_result.total_extracted,
            pages_processed=extraction_result.pages_processed,
            entries_embedded=embedding_result.embedded_count,
            entries_skipped=embedding_result.skipped_count,
            status="completed",
        )
