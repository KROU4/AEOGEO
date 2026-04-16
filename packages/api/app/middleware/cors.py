import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings

logger = logging.getLogger(__name__)


def setup_cors(app: FastAPI, settings: Settings) -> None:
    """Register CORS globally so error responses include CORS headers too."""
    allowed_origins = settings.cors_origins_list

    if not allowed_origins and not settings.cors_origin_regex:
        logger.warning("CORS is not configured; falling back to localhost:5173")
        allowed_origins = ["http://localhost:5173"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        allow_credentials=True,
        max_age=86400,
    )
