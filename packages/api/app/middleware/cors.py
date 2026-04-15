from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


def _cors_response_headers(request: Request) -> dict[str, str]:
    requested = (request.headers.get("access-control-request-headers") or "").strip()
    allow_headers = requested if requested else "*"
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT",
        "Access-Control-Allow-Headers": allow_headers,
        "Access-Control-Max-Age": "86400",
    }


class PermissiveCORSMiddleware(BaseHTTPMiddleware):
    """Explicit OPTIONS + headers on every response (more reliable than CORSMiddleware alone)."""

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=_cors_response_headers(request))

        response = await call_next(request)
        for key, value in _cors_response_headers(request).items():
            response.headers[key] = value
        return response


def setup_cors(app: FastAPI) -> None:
    app.add_middleware(PermissiveCORSMiddleware)
