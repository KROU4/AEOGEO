from __future__ import annotations

import threading
import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import FastAPI, Request, Response

_lock = threading.Lock()
_started_at = time.time()
_requests_total: dict[tuple[str, str, int], int] = defaultdict(int)
_latency_sum: dict[tuple[str, str, int], float] = defaultdict(float)
_latency_count: dict[tuple[str, str, int], int] = defaultdict(int)


def _labels(method: str, path: str, status_code: int) -> tuple[str, str, int]:
    return method.upper(), path, int(status_code)


def record_http_metric(
    *,
    method: str,
    path: str,
    status_code: int,
    duration_seconds: float,
) -> None:
    key = _labels(method, path, status_code)
    with _lock:
        _requests_total[key] += 1
        _latency_sum[key] += duration_seconds
        _latency_count[key] += 1


def render_prometheus_metrics() -> str:
    now = time.time()
    uptime = max(0.0, now - _started_at)

    lines = [
        "# HELP aeogeo_process_uptime_seconds Process uptime in seconds.",
        "# TYPE aeogeo_process_uptime_seconds gauge",
        f"aeogeo_process_uptime_seconds {uptime:.3f}",
        "# HELP aeogeo_http_requests_total Total HTTP requests.",
        "# TYPE aeogeo_http_requests_total counter",
    ]

    with _lock:
        sorted_keys = sorted(_requests_total.keys())
        for method, path, status in sorted_keys:
            label = f'method="{method}",path="{path}",status="{status}"'
            lines.append(f"aeogeo_http_requests_total{{{label}}} {_requests_total[(method, path, status)]}")

        lines.extend([
            "# HELP aeogeo_http_request_duration_seconds_sum Total request duration by label set.",
            "# TYPE aeogeo_http_request_duration_seconds_sum counter",
        ])
        for method, path, status in sorted_keys:
            label = f'method="{method}",path="{path}",status="{status}"'
            lines.append(
                "aeogeo_http_request_duration_seconds_sum"
                f"{{{label}}} {_latency_sum[(method, path, status)]:.6f}"
            )

        lines.extend([
            "# HELP aeogeo_http_request_duration_seconds_count Request duration sample count.",
            "# TYPE aeogeo_http_request_duration_seconds_count counter",
        ])
        for method, path, status in sorted_keys:
            label = f'method="{method}",path="{path}",status="{status}"'
            lines.append(
                "aeogeo_http_request_duration_seconds_count"
                f"{{{label}}} {_latency_count[(method, path, status)]}"
            )

    return "\n".join(lines) + "\n"


def setup_metrics(app: FastAPI) -> None:
    @app.middleware("http")
    async def collect_metrics(
        request: Request,
        call_next: Callable[[Request], Response],
    ) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - started

        route = request.scope.get("route")
        path = getattr(route, "path", request.url.path)
        record_http_metric(
            method=request.method,
            path=path,
            status_code=response.status_code,
            duration_seconds=elapsed,
        )
        return response
