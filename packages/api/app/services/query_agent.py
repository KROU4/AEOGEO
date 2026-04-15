"""Query Agent service — CRUD for QuerySets/Queries, AI query generation, intent clustering."""

import json
import logging
from uuid import UUID

import numpy as np
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.models.competitor import Competitor
from app.models.product import Product
from app.models.project import Project
from app.models.query import Query, QueryCluster, QuerySet
from app.schemas.query import (
    QueryCreate,
    QueryResponse,
    QuerySetCreate,
    QuerySetResponse,
    QuerySetUpdate,
    QueryUpdate,
    QueryClusterResponse,
)
from app.services.ai_client import AIClient
from app.utils.embeddings import generate_embeddings
from app.utils.locale import locale_instruction
from app.utils.pagination import (
    PaginatedResponse,
    apply_cursor_pagination,
    encode_cursor,
    paginate_results,
)

logger = logging.getLogger(__name__)


def _query_set_response(qs: QuerySet, query_count: int = 0) -> QuerySetResponse:
    return QuerySetResponse(
        id=qs.id,
        name=qs.name,
        description=qs.description,
        project_id=qs.project_id,
        query_count=query_count,
        created_at=qs.created_at,
        updated_at=qs.updated_at,
    )


def _query_response(q: Query) -> QueryResponse:
    return QueryResponse(
        id=q.id,
        text=q.text,
        category=q.category,
        priority=q.priority,
        status=q.status,
        query_set_id=q.query_set_id,
        cluster_id=q.cluster_id,
        created_at=q.created_at,
    )


def _cluster_response(c: QueryCluster, query_count: int = 0) -> QueryClusterResponse:
    return QueryClusterResponse(
        id=c.id,
        name=c.name,
        query_count=query_count,
        query_set_id=c.query_set_id,
    )


class QueryAgentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # QuerySet CRUD
    # ------------------------------------------------------------------

    async def create_query_set(
        self, project_id: UUID, data: QuerySetCreate
    ) -> QuerySetResponse:
        qs = QuerySet(
            name=data.name,
            description=data.description,
            project_id=project_id,
        )
        self.db.add(qs)
        await self.db.commit()
        await self.db.refresh(qs)
        return _query_set_response(qs, query_count=0)

    async def list_query_sets(
        self,
        project_id: UUID,
        cursor: str | None = None,
        limit: int = 20,
    ) -> PaginatedResponse[QuerySetResponse]:
        query_count_sq = (
            select(func.count())
            .where(Query.query_set_id == QuerySet.id)
            .correlate(QuerySet)
            .scalar_subquery()
        )

        query = select(QuerySet, query_count_sq.label("query_count")).where(
            QuerySet.project_id == project_id
        )
        query = apply_cursor_pagination(query, QuerySet, cursor, limit)

        result = await self.db.execute(query)
        rows = result.all()

        items_raw, next_cursor, has_more = paginate_results(
            rows, limit, created_at_attr="created_at", id_attr="id"
        )

        items: list[QuerySetResponse] = []
        for row in items_raw:
            qs = row[0] if hasattr(row, "__getitem__") else row.QuerySet
            qc = row[1] if hasattr(row, "__getitem__") else row.query_count
            items.append(_query_set_response(qs, query_count=qc or 0))

        # Recompute next_cursor from actual QuerySet objects
        if has_more and items_raw:
            last_row = items_raw[-1]
            last_qs = last_row[0] if hasattr(last_row, "__getitem__") else last_row.QuerySet
            next_cursor = encode_cursor(last_qs.created_at, last_qs.id)

        return PaginatedResponse(
            items=items, next_cursor=next_cursor, has_more=has_more
        )

    async def get_query_set(self, query_set_id: UUID) -> QuerySetResponse | None:
        query_count_sq = (
            select(func.count())
            .where(Query.query_set_id == QuerySet.id)
            .correlate(QuerySet)
            .scalar_subquery()
        )

        result = await self.db.execute(
            select(QuerySet, query_count_sq.label("query_count")).where(
                QuerySet.id == query_set_id
            )
        )
        row = result.one_or_none()
        if row is None:
            return None

        qs, qc = row
        return _query_set_response(qs, query_count=qc or 0)

    async def update_query_set(
        self, query_set_id: UUID, data: QuerySetUpdate
    ) -> QuerySetResponse | None:
        result = await self.db.execute(
            select(QuerySet).where(QuerySet.id == query_set_id)
        )
        qs = result.scalar_one_or_none()
        if qs is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(qs, key, value)

        await self.db.commit()
        await self.db.refresh(qs)
        return await self.get_query_set(query_set_id)

    async def delete_query_set(self, query_set_id: UUID) -> bool:
        result = await self.db.execute(
            select(QuerySet).where(QuerySet.id == query_set_id)
        )
        qs = result.scalar_one_or_none()
        if qs is None:
            return False

        # Delete clusters and queries first (cascades should handle this,
        # but being explicit for clarity)
        await self.db.execute(
            delete(Query).where(Query.query_set_id == query_set_id)
        )
        await self.db.execute(
            delete(QueryCluster).where(QueryCluster.query_set_id == query_set_id)
        )
        await self.db.delete(qs)
        await self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Query CRUD
    # ------------------------------------------------------------------

    async def create_query(
        self, query_set_id: UUID, data: QueryCreate
    ) -> QueryResponse | None:
        # Verify query set exists
        result = await self.db.execute(
            select(QuerySet).where(QuerySet.id == query_set_id)
        )
        if result.scalar_one_or_none() is None:
            return None

        q = Query(
            text=data.text,
            category=data.category,
            priority=data.priority,
            status="pending",
            query_set_id=query_set_id,
        )
        self.db.add(q)
        await self.db.commit()
        await self.db.refresh(q)
        return _query_response(q)

    async def list_queries(
        self,
        query_set_id: UUID,
        category: str | None = None,
        status: str | None = None,
        cursor: str | None = None,
        limit: int = 50,
    ) -> PaginatedResponse[QueryResponse]:
        query = select(Query).where(Query.query_set_id == query_set_id)

        if category:
            query = query.where(Query.category == category)
        if status:
            query = query.where(Query.status == status)

        query = apply_cursor_pagination(query, Query, cursor, limit)

        result = await self.db.execute(query)
        rows = list(result.scalars().all())

        items_raw, next_cursor, has_more = paginate_results(rows, limit)
        return PaginatedResponse(
            items=[_query_response(q) for q in items_raw],
            next_cursor=next_cursor,
            has_more=has_more,
        )

    async def update_query(
        self, query_id: UUID, data: QueryUpdate
    ) -> QueryResponse | None:
        result = await self.db.execute(
            select(Query).where(Query.id == query_id)
        )
        q = result.scalar_one_or_none()
        if q is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(q, key, value)

        await self.db.commit()
        await self.db.refresh(q)
        return _query_response(q)

    async def delete_query(self, query_id: UUID) -> bool:
        result = await self.db.execute(
            select(Query).where(Query.id == query_id)
        )
        q = result.scalar_one_or_none()
        if q is None:
            return False

        await self.db.delete(q)
        await self.db.commit()
        return True

    async def batch_update_status(
        self, query_ids: list[UUID], status: str
    ) -> int:
        """Update the status of multiple queries at once. Returns the count of updated rows."""
        if not query_ids:
            return 0

        result = await self.db.execute(
            update(Query)
            .where(Query.id.in_(query_ids))
            .values(status=status)
        )
        await self.db.commit()
        return result.rowcount  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # AI Query Generation
    # ------------------------------------------------------------------

    async def generate_queries(
        self,
        query_set_id: UUID,
        project_id: UUID,
        ai_client: AIClient,
        count: int = 50,
    ) -> list[QueryResponse]:
        """Generate queries using LLM based on brand context.

        Loads brand, products, competitors, and knowledge entries for the
        project, builds a prompt, calls the LLM, and saves the generated
        queries with status='pending'.
        """
        # Verify query set exists
        qs_result = await self.db.execute(
            select(QuerySet).where(QuerySet.id == query_set_id)
        )
        if qs_result.scalar_one_or_none() is None:
            raise ValueError(f"QuerySet {query_set_id} not found")

        # Load project locale
        project = await self.db.scalar(
            select(Project).where(Project.id == project_id)
        )
        content_locale = project.content_locale if project else "en"

        # Load brand context
        brand_result = await self.db.execute(
            select(Brand).where(Brand.project_id == project_id)
        )
        brand = brand_result.scalar_one_or_none()
        if brand is None:
            raise ValueError(f"No brand found for project {project_id}")

        # Load products
        products_result = await self.db.execute(
            select(Product).where(Product.brand_id == brand.id)
        )
        products = list(products_result.scalars().all())

        # Load competitors
        competitors_result = await self.db.execute(
            select(Competitor).where(Competitor.brand_id == brand.id)
        )
        competitors = list(competitors_result.scalars().all())

        # Build context strings
        products_text = "\n".join(
            f"- {p.name}: {p.description or 'No description'}"
            + (f" (Category: {p.category})" if p.category else "")
            + (f" (Pricing: {p.pricing})" if p.pricing else "")
            for p in products
        ) or "No products listed"

        competitors_text = "\n".join(
            f"- {c.name}"
            + (f" ({c.website})" if c.website else "")
            + (f": {c.positioning}" if c.positioning else "")
            for c in competitors
        ) or "No competitors listed"

        knowledge_text = "No knowledge base (not used in this product scope)"

        prompt = f"""You are an AI visibility analyst. Your job is to generate search queries that real users would ask AI assistants (ChatGPT, Gemini, Perplexity, Claude, etc.) where the brand "{brand.name}" SHOULD ideally appear in the AI's answer — but the query itself must NOT mention the brand name.

The goal is to measure organic AI visibility: does the AI naturally recommend or mention this brand when people ask relevant questions?

CRITICAL RULES:
- Do NOT include the brand name "{brand.name}" in any query text
- Do NOT include product names ({', '.join(p.name for p in products) if products else 'none'}) in query text
- Queries should sound like what a real person types into an AI assistant
- Each query should be a scenario where "{brand.name}" could reasonably appear in the answer

Categorize each query as one of: brand, product, competitive, informational
Assign priority 1-5 (5 = highest commercial intent)

Brand context (use this to understand the domain, NOT to include in queries):
- Positioning: {brand.positioning or brand.description or 'No positioning defined'}
- Website: {brand.website or 'Not specified'}

Products/services offered:
{products_text}

Known competitors:
{competitors_text}

Domain knowledge:
{knowledge_text}

Return a JSON array of objects with exactly these keys: "text", "category", "priority"

Category guidelines and distribution:
- brand (~10%): Generic reputation/review queries where the brand should surface. Example: "best {brand.positioning or 'companies'} in [industry]"
- product (~35%): Queries about the type of product/service the brand offers, without naming it. Example: "best tool for [what the product does]"
- competitive (~25%): Comparison and alternative queries that name competitors but NOT this brand. Example: "alternatives to [competitor name]", "[competitor A] vs [competitor B]"
- informational (~30%): Domain expertise questions where the brand should be cited as a source. Example: "how to [solve problem the brand addresses]"

Generate exactly {count} queries. Return ONLY the JSON array, no other text."""

        messages = [
            {"role": "system", "content": "You are a precise JSON generator. Always return valid JSON arrays." + locale_instruction(content_locale)},
            {"role": "user", "content": prompt},
        ]

        response = await ai_client.complete(
            provider="openai",
            model="gpt-4o-mini",
            messages=messages,
            request_type="query_generation",
            temperature=0.8,
            max_tokens=8192,
        )

        # Parse LLM response
        raw_content = response.content.strip()
        # Handle markdown code blocks if present
        if raw_content.startswith("```"):
            lines = raw_content.split("\n")
            # Remove first and last lines (``` markers)
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw_content = "\n".join(lines)

        try:
            generated = json.loads(raw_content)
        except json.JSONDecodeError:
            logger.error("Failed to parse LLM response as JSON: %s", raw_content[:500])
            raise ValueError("LLM returned invalid JSON for query generation")

        if not isinstance(generated, list):
            raise ValueError("LLM response is not a JSON array")

        # Validate and save queries
        valid_categories = {"brand", "product", "competitive", "informational"}
        created_queries: list[QueryResponse] = []

        for item in generated:
            if not isinstance(item, dict):
                continue

            text = item.get("text", "").strip()
            category = item.get("category", "informational").strip().lower()
            priority = item.get("priority", 3)

            if not text:
                continue
            if category not in valid_categories:
                category = "informational"
            if not isinstance(priority, int) or priority < 1 or priority > 5:
                priority = 3

            q = Query(
                text=text,
                category=category,
                priority=priority,
                status="pending",
                query_set_id=query_set_id,
            )
            self.db.add(q)
            await self.db.flush()
            created_queries.append(_query_response(q))

        await self.db.commit()

        logger.info(
            "Generated %d queries for query set %s",
            len(created_queries),
            query_set_id,
        )
        return created_queries

    # ------------------------------------------------------------------
    # Intent Clustering
    # ------------------------------------------------------------------

    async def cluster_queries(
        self,
        query_set_id: UUID,
        ai_client: AIClient,
        content_locale: str = "en",
    ) -> list[QueryClusterResponse]:
        """Cluster approved queries using k-means on embeddings.

        1. Load all approved queries in the set
        2. Generate embeddings for each query text
        3. Run k-means clustering
        4. Call LLM to generate descriptive cluster names
        5. Save QueryCluster records and update Query.cluster_id
        """
        # Load approved queries
        result = await self.db.execute(
            select(Query).where(
                Query.query_set_id == query_set_id,
                Query.status == "approved",
            )
        )
        queries = list(result.scalars().all())

        if len(queries) < 2:
            raise ValueError(
                "Need at least 2 approved queries to perform clustering"
            )

        # Generate embeddings for all query texts
        texts = [q.text for q in queries]
        embeddings = await generate_embeddings(texts)
        embedding_matrix = np.array(embeddings, dtype=np.float32)

        # Determine k
        k = min(len(queries) // 5, 10)
        k = max(k, 2)  # at least 2 clusters

        # K-means clustering
        labels, centroids = _kmeans(embedding_matrix, k, max_iter=50)

        # Delete existing clusters for this query set
        await self.db.execute(
            update(Query)
            .where(Query.query_set_id == query_set_id)
            .values(cluster_id=None)
        )
        await self.db.execute(
            delete(QueryCluster).where(QueryCluster.query_set_id == query_set_id)
        )
        await self.db.flush()

        # Group queries by cluster label
        cluster_groups: dict[int, list[Query]] = {}
        for idx, label in enumerate(labels):
            cluster_groups.setdefault(label, []).append(queries[idx])

        # Generate cluster names via LLM
        cluster_name_map = await self._generate_cluster_names(
            cluster_groups, ai_client, content_locale
        )

        # Create cluster records and assign queries
        cluster_responses: list[QueryClusterResponse] = []
        for label, group_queries in cluster_groups.items():
            cluster_name = cluster_name_map.get(label, f"Cluster {label + 1}")
            centroid = centroids[label].tolist()

            cluster = QueryCluster(
                name=cluster_name,
                centroid_embedding=centroid,
                query_set_id=query_set_id,
            )
            self.db.add(cluster)
            await self.db.flush()

            # Update queries with cluster_id
            query_ids = [q.id for q in group_queries]
            await self.db.execute(
                update(Query)
                .where(Query.id.in_(query_ids))
                .values(cluster_id=cluster.id)
            )

            cluster_responses.append(
                _cluster_response(cluster, query_count=len(group_queries))
            )

        await self.db.commit()

        logger.info(
            "Created %d clusters for query set %s",
            len(cluster_responses),
            query_set_id,
        )
        return cluster_responses

    async def _generate_cluster_names(
        self,
        cluster_groups: dict[int, list[Query]],
        ai_client: AIClient,
        content_locale: str = "en",
    ) -> dict[int, str]:
        """Call LLM to generate descriptive names for each cluster based on sample queries."""
        cluster_samples: dict[int, list[str]] = {}
        for label, group_queries in cluster_groups.items():
            # Take up to 5 sample queries per cluster
            samples = [q.text for q in group_queries[:5]]
            cluster_samples[label] = samples

        prompt_parts = []
        for label, samples in cluster_samples.items():
            sample_text = "\n".join(f"  - {s}" for s in samples)
            prompt_parts.append(f"Cluster {label}:\n{sample_text}")

        prompt = f"""Given the following clusters of search queries, generate a short descriptive name (2-5 words) for each cluster that captures the common theme/intent.

{chr(10).join(prompt_parts)}

Return a JSON object mapping cluster numbers to names.
Example: {{"0": "Brand Reputation", "1": "Product Comparison"}}

Return ONLY the JSON object, no other text."""

        messages = [
            {"role": "system", "content": "You are a precise JSON generator. Always return valid JSON." + locale_instruction(content_locale)},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await ai_client.complete(
                provider="openai",
                model="gpt-4o-mini",
                messages=messages,
                request_type="cluster_naming",
                temperature=0.3,
                max_tokens=1024,
            )

            raw_content = response.content.strip()
            if raw_content.startswith("```"):
                lines = raw_content.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                raw_content = "\n".join(lines)

            name_map = json.loads(raw_content)
            return {int(k): v for k, v in name_map.items()}
        except Exception:
            logger.warning("Failed to generate cluster names via LLM, using defaults")
            return {label: f"Cluster {label + 1}" for label in cluster_groups}

    # ------------------------------------------------------------------
    # Query Stats
    # ------------------------------------------------------------------

    async def list_clusters(
        self, query_set_id: UUID
    ) -> list[QueryClusterResponse]:
        """List all clusters for a query set with query counts."""
        query_count_sq = (
            select(func.count())
            .where(Query.cluster_id == QueryCluster.id)
            .correlate(QueryCluster)
            .scalar_subquery()
        )

        result = await self.db.execute(
            select(QueryCluster, query_count_sq.label("query_count")).where(
                QueryCluster.query_set_id == query_set_id
            )
        )
        rows = result.all()
        return [
            _cluster_response(row[0], query_count=row[1] or 0) for row in rows
        ]

    async def get_query_set_stats(self, query_set_id: UUID) -> dict | None:
        """Return summary statistics for a query set.

        Returns counts by status and by category.
        """
        # Verify query set exists
        qs_result = await self.db.execute(
            select(QuerySet).where(QuerySet.id == query_set_id)
        )
        if qs_result.scalar_one_or_none() is None:
            return None

        # Count by status
        status_result = await self.db.execute(
            select(Query.status, func.count())
            .where(Query.query_set_id == query_set_id)
            .group_by(Query.status)
        )
        by_status = {row[0]: row[1] for row in status_result.all()}

        # Count by category
        category_result = await self.db.execute(
            select(Query.category, func.count())
            .where(Query.query_set_id == query_set_id)
            .group_by(Query.category)
        )
        by_category = {row[0]: row[1] for row in category_result.all()}

        total = sum(by_status.values())

        return {
            "total": total,
            "by_status": by_status,
            "by_category": by_category,
        }


# ------------------------------------------------------------------
# K-means implementation (numpy only, no sklearn)
# ------------------------------------------------------------------


def _kmeans(
    data: np.ndarray,
    k: int,
    max_iter: int = 50,
    seed: int = 42,
) -> tuple[list[int], np.ndarray]:
    """Simple k-means clustering.

    Args:
        data: (n, d) array of data points.
        k: Number of clusters.
        max_iter: Maximum iterations.
        seed: Random seed for reproducibility.

    Returns:
        Tuple of (labels list, centroids array of shape (k, d)).
    """
    rng = np.random.RandomState(seed)
    n, d = data.shape

    # Initialize centroids via k-means++ style selection
    indices = [rng.randint(n)]
    for _ in range(1, k):
        centroids_so_far = data[indices]
        # Compute distances to nearest existing centroid
        dists = np.min(
            np.linalg.norm(data[:, None, :] - centroids_so_far[None, :, :], axis=2),
            axis=1,
        )
        # Square distances for probability weighting
        dists_sq = dists ** 2
        total = dists_sq.sum()
        if total == 0:
            # All points identical, pick random
            idx = rng.randint(n)
        else:
            probs = dists_sq / total
            idx = rng.choice(n, p=probs)
        indices.append(idx)

    centroids = data[indices].copy()
    labels = np.zeros(n, dtype=np.int32)

    for _ in range(max_iter):
        # Assignment step: assign each point to nearest centroid
        # Compute pairwise distances: (n, k)
        dists = np.linalg.norm(data[:, None, :] - centroids[None, :, :], axis=2)
        new_labels = np.argmin(dists, axis=1)

        # Check convergence
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels

        # Update step: recompute centroids
        for j in range(k):
            members = data[labels == j]
            if len(members) > 0:
                centroids[j] = members.mean(axis=0)

    return labels.tolist(), centroids
