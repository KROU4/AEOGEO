"""Parse Runner — LLM-based extraction of mentions and citations from AI answers.

Uses OpenAI function calling (tool use) to extract structured entity data from
raw AI engine responses. Results are cached in Redis to avoid re-processing
identical answer text.
"""

import asyncio
import hashlib
import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime

import httpx
from redis.asyncio import Redis
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.citation import Citation
from app.models.engine_run import EngineRun
from app.models.mention import Mention
from app.models.visibility_score import VisibilityScore

logger = logging.getLogger(__name__)

# Cache TTL: 30 days in seconds
CACHE_TTL = 30 * 24 * 60 * 60

# LLM settings
PARSE_MODEL = "gpt-4o-mini"
PARSE_TIMEOUT = 60.0

SYSTEM_PROMPT = """\
You are an expert at analyzing AI engine responses. Your task is to extract
structured information from a raw AI answer.

Given the text of an AI engine's response to a user query, identify:

1. **Mentions** — Any brand, product, company, or competitor explicitly named
   in the answer. For each mention, determine:
   - entity_name: the exact name as it appears
   - entity_type: one of "brand", "competitor", or "product"
   - sentiment: "positive", "neutral", or "negative" based on how the entity is
     described in context
   - position_in_answer: 1-based order of first appearance (1 = first entity
     mentioned, 2 = second, etc.)
   - is_recommended: true if the entity is explicitly recommended, suggested, or
     presented as a top choice
   - context_snippet: a short verbatim quote (1-2 sentences) showing how the
     entity is mentioned

2. **Citations** — Any URLs or source references cited in the answer. For each:
   - source_url: the full URL
   - source_title: descriptive title if available, otherwise infer from URL
   - is_client_source: false (the caller will reconcile this later)

Call the `extract_entities` function with your findings. If the answer contains
no identifiable mentions or citations, call the function with empty arrays.
"""

# OpenAI function-calling tool definition
EXTRACT_TOOL = {
    "type": "function",
    "function": {
        "name": "extract_entities",
        "description": "Extract brand/product/competitor mentions and source citations from an AI answer.",
        "parameters": {
            "type": "object",
            "properties": {
                "mentions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "entity_name": {"type": "string"},
                            "entity_type": {
                                "type": "string",
                                "enum": ["brand", "competitor", "product"],
                            },
                            "sentiment": {
                                "type": "string",
                                "enum": ["positive", "neutral", "negative"],
                            },
                            "position_in_answer": {
                                "type": "integer",
                                "description": "1-based order of appearance",
                            },
                            "is_recommended": {"type": "boolean"},
                            "context_snippet": {
                                "type": "string",
                                "description": "Short verbatim quote showing the mention in context",
                            },
                        },
                        "required": [
                            "entity_name",
                            "entity_type",
                            "sentiment",
                            "position_in_answer",
                            "is_recommended",
                            "context_snippet",
                        ],
                    },
                },
                "citations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source_url": {"type": "string"},
                            "source_title": {"type": "string"},
                            "is_client_source": {"type": "boolean"},
                        },
                        "required": ["source_url", "source_title", "is_client_source"],
                    },
                },
            },
            "required": ["mentions", "citations"],
        },
    },
}


@dataclass
class ParseResult:
    mentions_count: int
    citations_count: int
    cached: bool = False
    skipped: bool = False


@dataclass
class BatchResult:
    total_answers: int
    parsed: int
    cached: int
    skipped: int
    errors: int


class ParseRunnerService:
    """Extracts mentions and citations from AI answer text via LLM tool calling."""

    def __init__(
        self,
        db: AsyncSession,
        redis: Redis,
        api_key: str | None = None,
        base_url: str = "https://api.openai.com/v1/chat/completions",
    ):
        self.db = db
        self.redis = redis
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.base_url = base_url

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def parse_answer(self, answer_id: uuid.UUID) -> ParseResult:
        """Parse a single Answer, extracting Mentions and Citations.

        Uses a Redis cache keyed by sha256(raw_response) so identical answer
        text is never sent to the LLM twice.
        """
        # 1. Load answer from DB
        result = await self.db.execute(
            select(Answer).where(Answer.id == answer_id)
        )
        answer = result.scalar_one_or_none()
        if answer is None:
            raise ValueError(f"Answer {answer_id} not found")

        if not answer.raw_response or not answer.raw_response.strip():
            logger.warning("Answer %s has empty raw_response, skipping", answer_id)
            answer.parse_status = "completed"
            answer.parse_error = None
            answer.parsed_at = datetime.utcnow()
            answer.score_status = "pending"
            answer.score_error = None
            answer.scored_at = None
            await self.db.flush()
            return ParseResult(mentions_count=0, citations_count=0, cached=False)

        # 2. Check Redis cache
        content_hash = hashlib.sha256(answer.raw_response.encode("utf-8")).hexdigest()
        cache_key = f"parse:{content_hash}"

        if answer.parse_status == "completed" and answer.parse_fingerprint == content_hash:
            counts = await self._existing_extraction_counts(answer_id)
            return ParseResult(
                mentions_count=counts["mentions"],
                citations_count=counts["citations"],
                cached=False,
                skipped=True,
            )

        await self._prepare_answer_for_parse(answer, content_hash)

        cached_data = await self.redis.get(cache_key)
        if cached_data is not None:
            logger.info("Cache hit for answer %s (hash=%s)", answer_id, content_hash[:12])
            extraction = json.loads(cached_data)
            counts = await self._save_extraction(answer, extraction)
            return ParseResult(
                mentions_count=counts["mentions"],
                citations_count=counts["citations"],
                cached=True,
            )

        # 3. Call LLM with tool calling
        logger.info("Calling LLM for answer %s (hash=%s)", answer_id, content_hash[:12])
        extraction = await self._call_llm(answer.raw_response)

        # 4. Cache result
        await self.redis.set(cache_key, json.dumps(extraction), ex=CACHE_TTL)

        # 5. Create Mention and Citation records
        counts = await self._save_extraction(answer, extraction)

        return ParseResult(
            mentions_count=counts["mentions"],
            citations_count=counts["citations"],
            cached=False,
        )

    async def parse_run_answers(
        self,
        run_id: uuid.UUID,
        batch_size: int = 20,
    ) -> dict:
        """Parse all answers for an EngineRun in batches.

        Returns a summary dict: {total_answers, parsed, cached, errors}.
        """
        # Load all answers for the run
        result = await self.db.execute(
            select(Answer).where(Answer.run_id == run_id).order_by(Answer.sample_index)
        )
        answers = list(result.scalars().all())

        total = len(answers)
        parsed = 0
        cached = 0
        skipped = 0
        errors = 0
        run = await self.db.get(EngineRun, run_id)

        # Process in batches — LLM calls run concurrently, DB writes sequentially
        sem = asyncio.Semaphore(5)

        async def _fetch_llm(answer: Answer) -> tuple[Answer, str | None, dict | None, str]:
            """Resolve extraction data (cache or LLM) without touching the DB."""
            content_hash = hashlib.sha256(answer.raw_response.encode("utf-8")).hexdigest()

            # Already parsed with same fingerprint → skip
            if answer.parse_status == "completed" and answer.parse_fingerprint == content_hash:
                return answer, "skipped", None, content_hash

            # Check Redis cache
            cache_key = f"parse:{content_hash}"
            cached_data = await self.redis.get(cache_key)
            if cached_data is not None:
                return answer, "cached", json.loads(cached_data), content_hash

            # Call LLM (rate-limited by semaphore)
            async with sem:
                extraction = await self._call_llm(answer.raw_response)
            await self.redis.set(cache_key, json.dumps(extraction), ex=CACHE_TTL)
            return answer, "parsed", extraction, content_hash

        for i in range(0, total, batch_size):
            batch = answers[i : i + batch_size]

            # Phase 1: parallel LLM / cache resolution
            tasks = []
            empty_answers = []
            for answer in batch:
                if not answer.raw_response or not answer.raw_response.strip():
                    empty_answers.append(answer)
                else:
                    tasks.append(_fetch_llm(answer))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Phase 2: sequential DB writes
            for answer in empty_answers:
                answer.parse_status = "completed"
                answer.parse_error = None
                answer.parsed_at = datetime.utcnow()
                answer.score_status = "pending"
                answer.score_error = None
                answer.scored_at = None
                skipped += 1
                await self.db.flush()

            for result in results:
                if isinstance(result, Exception):
                    logger.exception("Failed to parse answer: %s", result)
                    errors += 1
                    continue

                answer, status, extraction, content_hash = result
                try:
                    if status == "skipped":
                        skipped += 1
                    elif extraction is not None:
                        await self._prepare_answer_for_parse(answer, content_hash)
                        await self._save_extraction(answer, extraction)
                        parsed += 1
                        if status == "cached":
                            cached += 1
                except Exception as exc:
                    logger.exception("Failed to save parse for answer %s", answer.id)
                    answer.parse_status = "failed"
                    answer.parse_error = str(exc)[:2000]
                    answer.score_status = "pending"
                    answer.score_error = None
                    errors += 1

                if run is not None:
                    run.parse_completed = parsed + skipped
                await self.db.flush()

        await self.db.commit()

        return {
            "total_answers": total,
            "parsed": parsed,
            "cached": cached,
            "skipped": skipped,
            "errors": errors,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _call_llm(self, raw_response: str) -> dict:
        """Call LLM with function calling to extract mentions and citations."""
        if not self.api_key:
            raise RuntimeError("No API key configured for parse runner")

        model = PARSE_MODEL
        if "openrouter" in self.base_url:
            model = f"openai/{PARSE_MODEL}"

        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Here is the raw AI engine response to analyze:\n\n"
                        f"---\n{raw_response}\n---"
                    ),
                },
            ],
            "tools": [EXTRACT_TOOL],
            "tool_choice": {
                "type": "function",
                "function": {"name": "extract_entities"},
            },
            "temperature": 0.0,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if "openrouter" in self.base_url:
            headers["HTTP-Referer"] = "https://sand-source.com"
            headers["X-Title"] = "AEOGEO"

        async with httpx.AsyncClient(timeout=PARSE_TIMEOUT) as client:
            resp = await client.post(self.base_url, headers=headers, json=body)

        if resp.status_code != 200:
            raise RuntimeError(
                f"LLM API error during parsing: {resp.status_code} {resp.text[:300]}"
            )

        data = resp.json()
        message = data["choices"][0]["message"]

        # Extract the tool call arguments
        tool_calls = message.get("tool_calls", [])
        if not tool_calls:
            logger.warning("LLM did not return a tool call, returning empty extraction")
            return {"mentions": [], "citations": []}

        arguments_str = tool_calls[0]["function"]["arguments"]
        try:
            extraction = json.loads(arguments_str)
        except json.JSONDecodeError:
            logger.error("Failed to parse LLM tool call arguments: %s", arguments_str[:500])
            return {"mentions": [], "citations": []}

        # Validate structure
        if "mentions" not in extraction:
            extraction["mentions"] = []
        if "citations" not in extraction:
            extraction["citations"] = []

        return extraction

    async def _prepare_answer_for_parse(
        self,
        answer: Answer,
        fingerprint: str,
    ) -> None:
        """Reset derived rows before parsing so reruns are idempotent."""
        await self.db.execute(delete(VisibilityScore).where(VisibilityScore.answer_id == answer.id))
        await self.db.execute(delete(Mention).where(Mention.answer_id == answer.id))
        await self.db.execute(delete(Citation).where(Citation.answer_id == answer.id))

        answer.parse_status = "running"
        answer.parse_error = None
        answer.parse_fingerprint = fingerprint
        answer.score_status = "pending"
        answer.score_error = None
        answer.scored_at = None

        await self.db.flush()

    async def _existing_extraction_counts(self, answer_id: uuid.UUID) -> dict[str, int]:
        """Return existing extraction counts for a previously parsed answer."""
        mentions_count = await self.db.scalar(
            select(func.count()).select_from(Mention).where(Mention.answer_id == answer_id)
        )
        citations_count = await self.db.scalar(
            select(func.count()).select_from(Citation).where(Citation.answer_id == answer_id)
        )
        return {
            "mentions": mentions_count or 0,
            "citations": citations_count or 0,
        }

    async def _save_extraction(
        self, answer: Answer, extraction: dict
    ) -> dict[str, int]:
        """Create Mention and Citation records from an extraction result.

        Returns counts: {"mentions": N, "citations": N}.
        """
        mentions_data = extraction.get("mentions", [])
        citations_data = extraction.get("citations", [])

        mention_count = 0
        for m in mentions_data:
            mention = Mention(
                answer_id=answer.id,
                entity_name=m.get("entity_name", ""),
                entity_type=m.get("entity_type", "brand"),
                sentiment=m.get("sentiment", "neutral"),
                position_in_answer=m.get("position_in_answer"),
                is_recommended=m.get("is_recommended", False),
                context_snippet=m.get("context_snippet"),
            )
            self.db.add(mention)
            mention_count += 1

        citation_count = 0
        for c in citations_data:
            source_url = c.get("source_url", "")
            if not source_url:
                continue
            citation = Citation(
                answer_id=answer.id,
                source_url=source_url,
                source_title=c.get("source_title"),
                is_client_source=c.get("is_client_source", False),
            )
            self.db.add(citation)
            citation_count += 1

        answer.parse_status = "completed"
        answer.parse_error = None
        answer.parsed_at = datetime.utcnow()
        answer.score_status = "pending"
        answer.score_error = None
        answer.scored_at = None

        # Flush to assign IDs but don't commit yet (caller manages transaction)
        await self.db.flush()

        return {"mentions": mention_count, "citations": citation_count}
