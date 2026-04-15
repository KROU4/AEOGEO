from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings


def _normalize_cors_origin(value: str) -> str:
    return value.strip().rstrip("/")


def setup_cors(app: FastAPI) -> None:
    settings = Settings()
    origins = [
        _normalize_cors_origin(o)
        for o in settings.cors_origins.split(",")
        if o.strip()
    ]
    origin_regex = (settings.cors_origin_regex or "").strip() or None

    # Bearer-only API (no Set-Cookie). allow_credentials=False avoids stricter browser rules
    # for credentialed cross-origin responses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
