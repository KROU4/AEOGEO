"""Google Analytics Data API (GA4) client — fetches traffic reports via REST."""

from __future__ import annotations

import json
import time
from datetime import date

import httpx
from jose import jwt

from app.schemas.analytics import TrafficDataPoint

GA4_API_BASE = "https://analyticsdata.googleapis.com/v1beta"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/analytics.readonly"


class GA4Error(RuntimeError):
    pass


class GA4Client:
    """Async client for Google Analytics Data API (GA4)."""

    async def fetch_report(
        self,
        property_id: str,
        service_account_json: str,
        start_date: date,
        end_date: date,
    ) -> list[TrafficDataPoint]:
        sa_info = json.loads(service_account_json)
        access_token = await self._get_access_token(sa_info)

        # Ensure property_id has the correct format
        if property_id.startswith("properties/"):
            prop = property_id
        else:
            prop = f"properties/{property_id}"

        body = {
            "dateRanges": [
                {
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                }
            ],
            "metrics": [
                {"name": "sessions"},
                {"name": "screenPageViews"},
                {"name": "totalUsers"},
            ],
            "dimensions": [
                {"name": "date"},
                {"name": "sessionDefaultChannelGroup"},
            ],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{GA4_API_BASE}/{prop}:runReport",
                json=body,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code != 200:
                raise GA4Error(
                    f"GA4 API error {resp.status_code}: {resp.text}"
                )
            data = resp.json()

        return self._parse_response(data)

    async def test_connection(
        self,
        property_id: str,
        service_account_json: str,
    ) -> bool:
        """Test connectivity by fetching metadata."""
        sa_info = json.loads(service_account_json)
        access_token = await self._get_access_token(sa_info)
        if property_id.startswith("properties/"):
            prop = property_id
        else:
            prop = f"properties/{property_id}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"https://analyticsdata.googleapis.com/v1beta/{prop}/metadata",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            return resp.status_code == 200

    async def _get_access_token(self, sa_info: dict) -> str:
        now = int(time.time())
        payload = {
            "iss": sa_info["client_email"],
            "sub": sa_info["client_email"],
            "aud": GOOGLE_TOKEN_URL,
            "iat": now,
            "exp": now + 3600,
            "scope": SCOPE,
        }
        assertion = jwt.encode(
            payload,
            sa_info["private_key"],
            algorithm="RS256",
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                },
            )
            if resp.status_code != 200:
                raise GA4Error(f"Token exchange failed: {resp.text}")
            return resp.json()["access_token"]

    def _parse_response(self, data: dict) -> list[TrafficDataPoint]:
        """Parse GA4 runReport response into TrafficDataPoints, aggregated by date."""
        rows = data.get("rows", [])
        # Aggregate by date across channel groups
        by_date: dict[str, dict] = {}

        for row in rows:
            dims = row.get("dimensionValues", [])
            metrics = row.get("metricValues", [])
            raw_date = dims[0]["value"]  # YYYYMMDD format
            channel = dims[1]["value"] if len(dims) > 1 else "unknown"

            sessions = int(metrics[0]["value"]) if metrics else 0
            pageviews = int(metrics[1]["value"]) if len(metrics) > 1 else 0
            users = int(metrics[2]["value"]) if len(metrics) > 2 else 0

            if raw_date not in by_date:
                by_date[raw_date] = {
                    "sessions": 0,
                    "pageviews": 0,
                    "users": 0,
                    "sources": {},
                }

            entry = by_date[raw_date]
            entry["sessions"] += sessions
            entry["pageviews"] += pageviews
            entry["users"] += users
            entry["sources"][channel] = entry["sources"].get(channel, 0) + sessions

        result: list[TrafficDataPoint] = []
        for raw_date, entry in sorted(by_date.items()):
            d = date(int(raw_date[:4]), int(raw_date[4:6]), int(raw_date[6:8]))
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
