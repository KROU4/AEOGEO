from app.middleware.metrics import record_http_metric, render_prometheus_metrics


def test_metrics_renderer_includes_recorded_http_counters():
    record_http_metric(
        method="GET",
        path="/api/v1/health",
        status_code=200,
        duration_seconds=0.012,
    )
    payload = render_prometheus_metrics()

    assert "aeogeo_process_uptime_seconds" in payload
    assert "aeogeo_http_requests_total" in payload
    assert 'method="GET",path="/api/v1/health",status="200"' in payload
    assert "aeogeo_http_request_duration_seconds_sum" in payload
    assert "aeogeo_http_request_duration_seconds_count" in payload
