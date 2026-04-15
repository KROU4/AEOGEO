"""Knowledge router — CRUD for knowledge entries, semantic search,
crawl, and file uploads."""

import json
import logging
from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.knowledge import (
    CrawlKnowledgePreview,
    CrawlPagePreview,
    CrawlRequest,
    CrawlResponse,
    CustomFileResponse,
    KnowledgeEntryCreate,
    KnowledgeEntryResponse,
    KnowledgeEntryUpdate,
    SemanticSearchRequest,
)
from app.services.knowledge import KnowledgeService
from app.utils.pagination import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/projects/{project_id}/knowledge", tags=["knowledge"]
)


def _compact_preview(value: str | None, max_chars: int = 220) -> str | None:
    if not value:
        return None
    compact = " ".join(value.split())
    if len(compact) <= max_chars:
        return compact
    return compact[: max_chars - 1].rstrip() + "..."


# ------------------------------------------------------------------
# Knowledge entries
# ------------------------------------------------------------------


@router.get(
    "/entries", response_model=PaginatedResponse[KnowledgeEntryResponse]
)
async def list_entries(
    project_id: UUID,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PaginatedResponse[KnowledgeEntryResponse]:
    service = KnowledgeService(db)
    result = await service.list_entries(
        project_id, user.tenant_id, cursor, limit, entry_type=type
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.post(
    "/entries", response_model=KnowledgeEntryResponse, status_code=201
)
async def create_entry(
    project_id: UUID,
    body: KnowledgeEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeEntryResponse:
    service = KnowledgeService(db)
    result = await service.create_entry(project_id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.put(
    "/entries/{entry_id}", response_model=KnowledgeEntryResponse
)
async def update_entry(
    project_id: UUID,
    entry_id: UUID,
    body: KnowledgeEntryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeEntryResponse:
    service = KnowledgeService(db)
    result = await service.update_entry(
        entry_id, project_id, user.tenant_id, body
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return result


@router.delete("/entries/{entry_id}")
async def delete_entry(
    project_id: UUID,
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = KnowledgeService(db)
    deleted = await service.delete_entry(
        entry_id, project_id, user.tenant_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}


# ------------------------------------------------------------------
# Semantic search
# ------------------------------------------------------------------


@router.post(
    "/search", response_model=list[KnowledgeEntryResponse]
)
async def semantic_search(
    project_id: UUID,
    body: SemanticSearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[KnowledgeEntryResponse]:
    # Generate embedding from the query text
    try:
        from app.utils.embeddings import generate_embedding

        query_embedding = await generate_embedding(body.query)
    except (ImportError, Exception):
        # If embeddings util is not yet available, return empty results
        raise HTTPException(
            status_code=501,
            detail="Embedding service not yet configured",
        )

    service = KnowledgeService(db)
    result = await service.semantic_search(
        project_id, user.tenant_id, query_embedding, limit=body.limit
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


# ------------------------------------------------------------------
# Website Crawling
# ------------------------------------------------------------------


@router.post("/crawl", response_model=CrawlResponse)
async def crawl_website(
    project_id: UUID,
    body: CrawlRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> CrawlResponse:
    """Crawl a website and extract knowledge entries for the project's brand."""
    from app.crawl_availability import CrawlStackUnavailableError
    from app.services.ai_client import AIClient
    from app.services.brand import BrandService
    from app.services.ingestion import IngestionService

    # Resolve brand for this project
    brand_service = BrandService(db)
    brand = await brand_service.get_brand(project_id, user.tenant_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found for this project")

    # Normalize domain
    domain = body.domain.strip()
    if not domain.startswith("http://") and not domain.startswith("https://"):
        url = f"https://{domain}"
    else:
        url = domain

    ai_client = AIClient(
        db=db, redis=redis, tenant_id=user.tenant_id, user_id=user.id,
    )
    ingestion = IngestionService(db, ai_client=ai_client)

    # Step 1: Crawl
    try:
        crawl_result = await ingestion.crawl_website(
            brand_id=brand.id,
            url=url,
            max_pages=body.max_pages,
            max_depth=2,
        )
    except CrawlStackUnavailableError as e:
        raise HTTPException(
            status_code=503,
            detail={"code": "crawl.not_installed", "message": str(e)},
        ) from e
    except Exception as e:
        logger.error("Crawl failed for project %s: %s", project_id, e)
        raise HTTPException(status_code=502, detail=f"Crawl failed: {e}")

    pages_crawled = crawl_result.get("successful_pages", 0)

    # Step 2: Extract knowledge from crawled pages via AIClient
    entries_created = 0
    extraction_errors = 0
    extracted_entries: list[CrawlKnowledgePreview] = []
    for page in crawl_result.get("pages", []):
        if page.get("status") != "success" or not page.get("content"):
            continue
        try:
            entries = await ingestion.extract_knowledge_from_text(
                brand_id=brand.id,
                text=page["content"],
                source_url=page.get("url"),
            )
            entries_created += len(entries)
            for entry in entries:
                content_preview = _compact_preview(entry.get("content"))
                if not content_preview:
                    continue
                extracted_entries.append(
                    CrawlKnowledgePreview(
                        type=str(entry.get("type") or "fact"),
                        content=content_preview,
                        source_url=entry.get("source_url"),
                    )
                )
        except Exception as e:
            extraction_errors += 1
            logger.warning("Extraction failed for %s: %s", page.get("url", "?"), e)

    # Step 3: Generate embeddings
    try:
        await ingestion.generate_embeddings_for_brand(brand.id)
    except Exception as e:
        logger.warning("Embedding generation failed: %s", e)

    pages = [
        CrawlPagePreview(
            url=str(page.get("url", "")),
            title=page.get("title") or None,
            status=str(page.get("status", "unknown")),
            content_preview=_compact_preview(page.get("content")),
            error_message=page.get("error"),
        )
        for page in crawl_result.get("pages", [])
        if page.get("url")
    ]

    logger.info(
        "Crawl complete: project=%s pages_crawled=%d entries_created=%d",
        project_id, pages_crawled, entries_created,
    )

    return CrawlResponse(
        pages_crawled=pages_crawled,
        entries_created=entries_created,
        extraction_errors=extraction_errors,
        total_pages=crawl_result.get("total_pages", pages_crawled),
        pages=pages,
        knowledge_entries=extracted_entries[:24],
    )


def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/crawl/stream")
async def crawl_website_stream(
    project_id: UUID,
    body: CrawlRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Crawl a website and stream progress via SSE."""
    from app.crawl_availability import CrawlStackUnavailableError, require_crawl_stack
    from app.services.ai_client import AIClient
    from app.services.brand import BrandService
    from app.services.ingestion import IngestionService

    try:
        require_crawl_stack()
    except CrawlStackUnavailableError as e:
        raise HTTPException(
            status_code=503,
            detail={"code": "crawl.not_installed", "message": str(e)},
        ) from e

    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

    # Resolve brand before entering generator
    brand_service = BrandService(db)
    brand = await brand_service.get_brand(project_id, user.tenant_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found for this project")

    domain = body.domain.strip()
    if not domain.startswith("http://") and not domain.startswith("https://"):
        url = f"https://{domain}"
    else:
        url = domain

    ai_client = AIClient(
        db=db, redis=redis, tenant_id=user.tenant_id, user_id=user.id,
    )
    ingestion = IngestionService(db, ai_client=ai_client)
    max_pages = body.max_pages
    max_depth = 2

    async def event_generator() -> AsyncGenerator[str, None]:
        yield _sse_event("crawl_start", {"domain": domain, "max_pages": max_pages})

        # --- Phase 1: BFS Crawl ---
        pages: list[dict] = []
        visited: set[str] = set()
        to_visit: list[tuple[str, int]] = [(url, 0)]
        browser_config = BrowserConfig(headless=True, verbose=False)

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
                            content = str(result.markdown) if result.markdown else ""
                            if not content and result.cleaned_html:
                                content = result.cleaned_html

                            title = (
                                result.metadata.get("title", "")
                                if result.metadata
                                else ""
                            )
                            page_data = {
                                "url": current_url,
                                "title": title,
                                "content": content,
                                "status": "success",
                            }
                            pages.append(page_data)

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

                            yield _sse_event("page_crawled", {
                                "url": current_url,
                                "title": title,
                                "status": "success",
                                "content_preview": _compact_preview(content),
                                "pages_done": len(pages),
                                "pages_total": min(
                                    len(pages) + len(
                                        [u for u, _ in to_visit if u not in visited]
                                    ),
                                    max_pages,
                                ),
                            })
                        else:
                            error_msg = result.error_message or "Unknown error"
                            pages.append({
                                "url": current_url,
                                "title": "",
                                "content": "",
                                "status": "failed",
                                "error": error_msg,
                            })
                            yield _sse_event("page_crawled", {
                                "url": current_url,
                                "title": "",
                                "status": "failed",
                                "error_message": error_msg,
                                "pages_done": len(pages),
                                "pages_total": min(
                                    len(pages) + len(
                                        [u for u, _ in to_visit if u not in visited]
                                    ),
                                    max_pages,
                                ),
                            })
                    except Exception as e:
                        logger.warning("Failed to crawl %s: %s", current_url, e)
                        pages.append({
                            "url": current_url,
                            "title": "",
                            "content": "",
                            "status": "failed",
                            "error": str(e),
                        })
                        yield _sse_event("page_crawled", {
                            "url": current_url,
                            "title": "",
                            "status": "failed",
                            "error_message": str(e),
                            "pages_done": len(pages),
                            "pages_total": max_pages,
                        })
        except Exception as e:
            logger.error("Crawler initialization failed: %s", e)
            yield _sse_event("error", {"message": f"Crawler failed: {e}"})
            return

        # --- Phase 2: Extract knowledge per page ---
        successful_pages = [
            p for p in pages
            if p.get("status") == "success" and p.get("content")
        ]
        entries_created = 0
        extraction_errors = 0

        for i, page in enumerate(successful_pages):
            try:
                entries = await ingestion.extract_knowledge_from_text(
                    brand_id=brand.id,
                    text=page["content"],
                    source_url=page.get("url"),
                )
                entries_created += len(entries)
                previews = []
                for entry in entries:
                    preview = _compact_preview(entry.get("content"))
                    if preview:
                        previews.append({
                            "type": str(entry.get("type") or "fact"),
                            "content": preview,
                            "source_url": entry.get("source_url"),
                        })

                yield _sse_event("page_extracted", {
                    "url": page.get("url", ""),
                    "entries_count": len(entries),
                    "entries_total": entries_created,
                    "entries": previews,
                    "extraction_done": i + 1,
                    "extraction_total": len(successful_pages),
                })
            except Exception as e:
                extraction_errors += 1
                logger.warning("Extraction failed for %s: %s", page.get("url", "?"), e)
                yield _sse_event("page_extracted", {
                    "url": page.get("url", ""),
                    "entries_count": 0,
                    "entries_total": entries_created,
                    "entries": [],
                    "extraction_done": i + 1,
                    "extraction_total": len(successful_pages),
                })

        # --- Phase 3: Embeddings ---
        yield _sse_event("embedding_start", {})
        try:
            await ingestion.generate_embeddings_for_brand(brand.id)
        except Exception as e:
            logger.warning("Embedding generation failed: %s", e)

        # --- Done ---
        yield _sse_event("complete", {
            "pages_crawled": len(successful_pages),
            "entries_created": entries_created,
            "extraction_errors": extraction_errors,
        })

        logger.info(
            "Crawl stream complete: project=%s pages_crawled=%d entries_created=%d",
            project_id, len(successful_pages), entries_created,
        )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ------------------------------------------------------------------
# File upload / management
# ------------------------------------------------------------------


@router.post("/upload", response_model=CustomFileResponse, status_code=201)
async def upload_file(
    project_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CustomFileResponse:
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Filename is required")

    contents = await file.read()
    file_size = len(contents)

    # Determine file type from extension
    filename = file.filename
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"

    # Try to parse document text
    content_text: str | None = None
    try:
        from app.utils.document_parser import parse_document

        content_text = await parse_document(contents, ext)
    except (ImportError, Exception):
        # Parser not yet available — store file metadata only
        pass

    service = KnowledgeService(db)
    result = await service.create_file(
        project_id,
        user.tenant_id,
        filename=filename,
        file_type=ext,
        file_size=file_size,
        content_text=content_text,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.get("/files", response_model=list[CustomFileResponse])
async def list_files(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CustomFileResponse]:
    service = KnowledgeService(db)
    result = await service.list_files(project_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.delete("/files/{file_id}")
async def delete_file(
    project_id: UUID,
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = KnowledgeService(db)
    deleted = await service.delete_file(file_id, project_id, user.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return {"message": "File deleted"}
