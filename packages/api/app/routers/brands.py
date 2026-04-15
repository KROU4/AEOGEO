"""Brand router — CRUD for brands, products, and competitors under a project."""

import json
import logging
import re
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.brand import (
    BrandAutofillRequest,
    BrandAutofillResponse,
    BrandCreate,
    BrandResponse,
    BrandUpdate,
)
from app.schemas.competitor import (
    CompetitorCreate,
    CompetitorResponse,
    CompetitorSuggestionRequest,
    CompetitorSuggestionResponse,
    CompetitorUpdate,
)
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductSuggestionRequest,
    ProductSuggestionResponse,
    ProductUpdate,
)
from app.services.ai_client import (
    AIClient,
    NoAPIKeyError,
    ProviderError,
    RateLimitError,
    UsageLimitError,
)
from app.services.brand import BrandService
from app.services.discovery import DiscoveryError, DiscoveryService
from app.services.ingestion import IngestionService
from app.utils.locale import locale_instruction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/brand", tags=["brands"])

# Standalone router for endpoints that don't need a project_id
autofill_router = APIRouter(prefix="/brand", tags=["brands"])

BRAND_AUTOFILL_SYSTEM_PROMPT = """\
You are a brand analyst. Given website content, extract the following brand profile information.
Return a JSON object with these fields:
{
  "name": "The brand or company name as presented on the website",
  "description": "A concise 2-3 sentence description of what the brand/company does",
  "industry": "The primary industry or sector (e.g. SaaS, E-commerce, Healthcare, Education)",
  "tone_of_voice": "The brand's communication tone (e.g. Professional, Friendly, Technical, Casual)",
  "target_audience": "Who the brand serves (e.g. Small business owners, Enterprise CTOs)",
  "unique_selling_points": ["USP 1", "USP 2", "USP 3"]
}
Rules:
- Be concise and specific
- unique_selling_points should have 3-5 items max
- If you can't determine a field, use an empty string or empty array
- Return ONLY valid JSON, no markdown"""


def _parse_autofill_payload(raw_content: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw_content)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Some providers still wrap JSON in markdown fences despite the prompt.
    fenced_json_match = re.search(
        r"```(?:json)?\s*(\{.*\})\s*```",
        raw_content,
        re.DOTALL,
    )
    if fenced_json_match:
        parsed = json.loads(fenced_json_match.group(1))
        if isinstance(parsed, dict):
            return parsed

    json_object_match = re.search(r"(\{.*\})", raw_content, re.DOTALL)
    if json_object_match:
        parsed = json.loads(json_object_match.group(1))
        if isinstance(parsed, dict):
            return parsed

    raise json.JSONDecodeError("Could not find a JSON object in response", raw_content, 0)


def _clean_brand_name(value: str) -> str:
    name = re.sub(r"\s+", " ", value).strip()
    name = re.sub(r"\s+(official site|homepage|home)$", "", name, flags=re.IGNORECASE)
    return name.strip(" -|:.,")


def _derive_brand_name(url: str, page_title: str, extracted_name: str) -> str:
    cleaned_name = _clean_brand_name(extracted_name)
    if cleaned_name:
        return cleaned_name

    cleaned_title = _clean_brand_name(page_title)
    if cleaned_title:
        title_parts = [
            _clean_brand_name(part)
            for part in re.split(r"\s+[|\-:]\s+|\s+[-|:]\s+|[|\-:]", cleaned_title)
            if _clean_brand_name(part)
        ]
        if title_parts:
            return title_parts[0]
        return cleaned_title

    hostname = urlparse(url).hostname or ""
    hostname = re.sub(r"^www\.", "", hostname, flags=re.IGNORECASE)
    root = hostname.split(".", 1)[0]
    if not root:
        return ""
    if root.isupper():
        return root
    words = [segment for segment in re.split(r"[-_]+", root) if segment]
    return " ".join(word.capitalize() for word in words)


async def _raise_ai_http_exception(
    db: AsyncSession,
    exc: Exception,
) -> None:
    if isinstance(exc, UsageLimitError):
        raise HTTPException(
            status_code=429,
            detail={"code": "usage.limit_reached", "message": str(exc)},
        ) from exc
    if isinstance(exc, RateLimitError):
        raise HTTPException(
            status_code=429,
            detail={"code": "usage.rate_limited", "message": str(exc)},
        ) from exc
    if isinstance(exc, NoAPIKeyError):
        raise HTTPException(
            status_code=503,
            detail={"code": "ai_key.not_found", "message": str(exc)},
        ) from exc
    if isinstance(exc, ProviderError):
        await db.commit()
        raise HTTPException(
            status_code=502,
            detail={"code": "ai.provider_error", "message": str(exc)},
        ) from exc
    raise exc


# ------------------------------------------------------------------
# Brand
# ------------------------------------------------------------------


@router.get("", response_model=BrandResponse)
async def get_brand(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BrandResponse:
    service = BrandService(db)
    result = await service.get_brand(project_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.put("", response_model=BrandResponse)
async def upsert_brand(
    project_id: UUID,
    body: BrandCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BrandResponse:
    service = BrandService(db)
    try:
        return await service.get_or_create_brand(
            project_id, user.tenant_id, body
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Project not found")


@router.patch("", response_model=BrandResponse)
async def update_brand(
    project_id: UUID,
    body: BrandUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BrandResponse:
    service = BrandService(db)
    result = await service.update_brand(project_id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


# ------------------------------------------------------------------
# Autofill from website
# ------------------------------------------------------------------


@autofill_router.post("/autofill", response_model=BrandAutofillResponse)
async def autofill_brand(
    body: BrandAutofillRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> BrandAutofillResponse:
    """Crawl a website homepage and use an LLM to extract brand profile data."""

    # Normalize domain to a full URL
    domain = body.domain.strip()
    if not domain.startswith("http://") and not domain.startswith("https://"):
        url = f"https://{domain}"
    else:
        url = domain

    # --- Step 1: Crawl homepage only ---
    from app.crawl_availability import CrawlStackUnavailableError

    ingestion = IngestionService(db)
    try:
        crawl_result = await ingestion.crawl_website(
            brand_id=user.id,  # used only for logging context
            url=url,
            max_pages=1,
            max_depth=0,
        )
    except CrawlStackUnavailableError as e:
        raise HTTPException(
            status_code=503,
            detail={"code": "crawl.not_installed", "message": str(e)},
        ) from e
    except Exception as e:
        logger.error("Autofill crawl failed for %s: %s", url, e)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to crawl website: {e}",
        )

    # Check we got content
    successful_pages = [
        p for p in crawl_result.get("pages", []) if p.get("status") == "success"
    ]
    if not successful_pages:
        raise HTTPException(
            status_code=502,
            detail="Could not retrieve any content from the website.",
        )

    page_content = successful_pages[0].get("content", "")
    page_title = successful_pages[0].get("title", "")
    if not page_content or len(page_content.strip()) < 50:
        raise HTTPException(
            status_code=502,
            detail="Website returned insufficient content for analysis.",
        )

    # Truncate to fit context window
    max_chars = 30_000
    if len(page_content) > max_chars:
        page_content = page_content[:max_chars]

    # --- Step 2: LLM extraction ---
    client = AIClient(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
    )

    try:
        result = await client.complete(
            provider="openai",
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": BRAND_AUTOFILL_SYSTEM_PROMPT + locale_instruction(body.locale)},
                {
                    "role": "user",
                    "content": (
                        "Extract brand profile information from this website content:\n\n"
                        + page_content
                    ),
                },
            ],
            request_type="brand_autofill",
            temperature=0.2,
            max_tokens=1024,
        )
        await db.commit()
        raw_content = result.content
    except (
        UsageLimitError,
        RateLimitError,
        NoAPIKeyError,
        ProviderError,
    ) as exc:
        logger.error("LLM provider error during autofill: %s", exc)
        await _raise_ai_http_exception(db, exc)

    # --- Step 3: Parse and return ---
    try:
        extracted = _parse_autofill_payload(raw_content)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="LLM returned invalid JSON. Please try again.",
        )

    return BrandAutofillResponse(
        name=_derive_brand_name(url, page_title, extracted.get("name", "")),
        description=extracted.get("description", ""),
        industry=extracted.get("industry", ""),
        tone_of_voice=extracted.get("tone_of_voice", ""),
        target_audience=extracted.get("target_audience", ""),
        unique_selling_points=extracted.get("unique_selling_points", []),
    )


# ------------------------------------------------------------------
# Products
# ------------------------------------------------------------------


@router.post(
    "/products/suggest",
    response_model=ProductSuggestionResponse,
)
async def suggest_products(
    project_id: UUID,
    body: ProductSuggestionRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> ProductSuggestionResponse:
    service = DiscoveryService(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    try:
        return await service.suggest_products(
            project_id=project_id,
            max_suggestions=body.max_suggestions,
        )
    except DiscoveryError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except (
        UsageLimitError,
        RateLimitError,
        NoAPIKeyError,
        ProviderError,
    ) as exc:
        logger.error("Product suggestion failed for project %s: %s", project_id, exc)
        await _raise_ai_http_exception(db, exc)


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProductResponse]:
    service = BrandService(db)
    result = await service.list_products(project_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.post(
    "/products", response_model=ProductResponse, status_code=201
)
async def add_product(
    project_id: UUID,
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProductResponse:
    service = BrandService(db)
    result = await service.add_product(project_id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    project_id: UUID,
    product_id: UUID,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProductResponse:
    service = BrandService(db)
    result = await service.update_product(
        product_id, project_id, user.tenant_id, body
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return result


@router.delete("/products/{product_id}")
async def delete_product(
    project_id: UUID,
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = BrandService(db)
    deleted = await service.delete_product(
        product_id, project_id, user.tenant_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}


# ------------------------------------------------------------------
# Competitors
# ------------------------------------------------------------------


@router.post(
    "/competitors/suggest",
    response_model=CompetitorSuggestionResponse,
)
async def suggest_competitors(
    project_id: UUID,
    body: CompetitorSuggestionRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    user: User = Depends(get_current_user),
) -> CompetitorSuggestionResponse:
    service = DiscoveryService(
        db=db,
        redis=redis,
        tenant_id=user.tenant_id,
        user_id=user.id,
        project_id=project_id,
    )
    try:
        return await service.suggest_competitors(
            project_id=project_id,
            max_suggestions=body.max_suggestions,
        )
    except DiscoveryError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except (
        UsageLimitError,
        RateLimitError,
        NoAPIKeyError,
        ProviderError,
    ) as exc:
        logger.error("Competitor suggestion failed for project %s: %s", project_id, exc)
        await _raise_ai_http_exception(db, exc)


@router.get("/competitors", response_model=list[CompetitorResponse])
async def list_competitors(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CompetitorResponse]:
    service = BrandService(db)
    result = await service.list_competitors(project_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.post(
    "/competitors", response_model=CompetitorResponse, status_code=201
)
async def add_competitor(
    project_id: UUID,
    body: CompetitorCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CompetitorResponse:
    service = BrandService(db)
    result = await service.add_competitor(project_id, user.tenant_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return result


@router.put(
    "/competitors/{competitor_id}", response_model=CompetitorResponse
)
async def update_competitor(
    project_id: UUID,
    competitor_id: UUID,
    body: CompetitorUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CompetitorResponse:
    service = BrandService(db)
    result = await service.update_competitor(
        competitor_id, project_id, user.tenant_id, body
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return result


@router.delete("/competitors/{competitor_id}")
async def delete_competitor(
    project_id: UUID,
    competitor_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    service = BrandService(db)
    deleted = await service.delete_competitor(
        competitor_id, project_id, user.tenant_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return {"message": "Competitor deleted"}
