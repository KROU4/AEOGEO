import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings

logger = logging.getLogger(__name__)


def setup_cors(app: FastAPI, settings: Settings) -> None:
    """Register CORS globally so error responses include CORS headers too."""
    allowed_origins = [o for o in settings.cors_origins_list if o != "*"]
    origin_regex = (settings.cors_origin_regex or "").strip() or None

    if not allowed_origins and not origin_regex:
        logger.warning("CORS is not configured; falling back to localhost:5173")
        allowed_origins = ["http://localhost:5173"]

    if "*" in settings.cors_origins_list:
        logger.warning(
            "CORS_ORIGINS contains '*'; relying on allow_origin_regex / explicit origins "
            "(wildcard origin is invalid with allow_credentials=True)."
        )

    logger.info(
        "Configuring CORS: allow_origins=%s allow_origin_regex=%r",
        allowed_origins,
        origin_regex,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=origin_regex,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=True,
        max_age=86400,
    )
