from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app: FastAPI) -> None:
    """Register CORS at the ASGI level so headers appear on ALL responses,
    including error responses that bypass BaseHTTPMiddleware."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
        max_age=86400,
    )
