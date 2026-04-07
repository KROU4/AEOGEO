"""Yandex Metrica API client — fetches traffic reports via REST."""

from __future__ import annotations

from datetime import date

import httpx

from app.schemas.analytics import TrafficDataPoint

METRICA_API_BASE = "https://api-metrica.yandex.net/stat/v1/data"


class YandexMetricaError(RuntimeError):
    pass


class YandexMetricaClient:
    """Async client for Yandex Metrica API."""

    async def fetch_report(
        self,
        counter_id: str,
        oauth_token: str,
        start_date: date,
        end_date: date,
    ) -> list[TrafficDataPoint]:
        params = {
            "id": counter_id,
            "metrics": "ym:s:visits,ym:s:pageviews,ym:s:users",
            "dimensions": "ym:s:date,ym:s:lastTrafficSource",
            "date1": start_date.isoformat(),
            "date2": end_date.isoformat(),
            "limit": 10000,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                METRICA_API_BASE,
                params=params,
                headers={"Authorization": f"OAuth {oauth_token}"},
            )
            if resp.status_code != 200:
                raise YandexMetricaError(
                    f"Yandex Metrica API error {resp.status_code}: {resp.text}"
                )
            data = resp.json()

        return self._parse_response(data)

    async def test_connection(
        self,
        counter_id: str,
        oauth_token: str,
    ) -> bool:
        """Test connectivity by fetching 1 day of data."""
        params = {
            "id": counter_id,
            "metrics": "ym:s:visits",
            "date1": "today",
            "date2": "today",
            "limit": 1,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                METRICA_API_BASE,
                params=params,
                headers={"Authorization": f"OAuth {oauth_token}"},
            )
            return resp.status_code == 200

    def _parse_response(self, data: dict) -> list[TrafficDataPoint]:
        """Parse Yandex Metrica response into TrafficDataPoints, aggregated by date."""
        rows = data.get("data", [])
        by_date: dict[str, dict] = {}

        for row in rows:
            dims = row.get("dimensions", [])
            metrics = row.get("metrics", [])

            raw_date = dims[0]["name"] if dims else ""
            source = dims[1]["name"] if len(dims) > 1 else "unknown"

            visits = int(metrics[0]) if metrics else 0
            pageviews = int(metrics[1]) if len(metrics) > 1 else 0
            users = int(metrics[2]) if len(metrics) > 2 else 0

            if raw_date not in by_date:
                by_date[raw_date] = {
                    "sessions": 0,
                    "pageviews": 0,
                    "users": 0,
                    "sources": {},
                }

            entry = by_date[raw_date]
            entry["sessions"] += visits
            entry["pageviews"] += pageviews
            entry["users"] += users
            entry["sources"][source] = entry["sources"].get(source, 0) + visits

        result: list[TrafficDataPoint] = []
        for raw_date, entry in sorted(by_date.items()):
            try:
                d = date.fromisoformat(raw_date)
            except ValueError:
                continue
            result.append(
                TrafficDataPoint(
                    date=d,
                    pageviews=entry["pageviews"],
                    sessions=entry["sessions"],
                    users=entry["users"],
                    traffic_sources=entry["sources"],
                )
            )

        return result
