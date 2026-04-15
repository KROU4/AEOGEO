# Build from repository root: docker build -f packages/api/Dockerfile .
FROM python:3.12-slim AS base

WORKDIR /work/packages/api

RUN pip install --no-cache-dir uv

# Dependency manifests (monorepo: geo-audit path = ../geo-audit)
COPY packages/api/pyproject.toml packages/api/uv.lock ./
COPY packages/geo-audit ../geo-audit

RUN uv sync --no-dev

# Install Chromium for Crawl4AI website crawling
RUN uv run playwright install --with-deps chromium

COPY packages/api/app ./app
COPY packages/api/alembic ./alembic
COPY packages/api/alembic.ini ./

EXPOSE 8000

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
