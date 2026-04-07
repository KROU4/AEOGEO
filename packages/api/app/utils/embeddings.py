"""OpenAI embedding utilities.

Uses the text-embedding-3-large model via the OpenAI REST API
to generate vector embeddings for text content.
"""

from __future__ import annotations

import os

import httpx

OPENAI_API_URL = "https://api.openai.com/v1/embeddings"
EMBEDDING_MODEL = "text-embedding-3-large"
MAX_BATCH_SIZE = 2048


async def generate_embedding(text: str) -> list[float]:
    """Generate a single embedding vector for the given text.

    Args:
        text: The input text to embed.

    Returns:
        A list of floats representing the embedding vector.

    Raises:
        httpx.HTTPStatusError: If the OpenAI API returns an error.
        RuntimeError: If OPENAI_API_KEY is not set.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "input": text,
                "model": EMBEDDING_MODEL,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["data"][0]["embedding"]


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts.

    Splits into batches of up to 2048 texts (OpenAI API limit)
    and concatenates the results.

    Args:
        texts: List of input texts to embed.

    Returns:
        List of embedding vectors, one per input text, in the same order.

    Raises:
        httpx.HTTPStatusError: If the OpenAI API returns an error.
        RuntimeError: If OPENAI_API_KEY is not set.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    all_embeddings: list[list[float]] = []

    async with httpx.AsyncClient(timeout=120.0) as client:
        for i in range(0, len(texts), MAX_BATCH_SIZE):
            batch = texts[i : i + MAX_BATCH_SIZE]
            response = await client.post(
                OPENAI_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "input": batch,
                    "model": EMBEDDING_MODEL,
                },
            )
            response.raise_for_status()
            data = response.json()
            # Sort by index to preserve input order
            sorted_items = sorted(data["data"], key=lambda x: x["index"])
            all_embeddings.extend(item["embedding"] for item in sorted_items)

    return all_embeddings
