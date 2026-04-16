# Build from repository root: docker build -f packages/api/Dockerfile .
# INSTALL_CRAWL=1 (default): optional crawl extra + Chromium for Crawl4AI (slow build, full prod).
# INSTALL_CRAWL=0: skip crawl/playwright — fast image for API-only / dev without website crawl.
FROM python:3.12-slim AS base

WORKDIR /work/packages/api

RUN pip install --no-cache-dir uv

# Dependency manifests (monorepo: geo-audit path = ../geo-audit)
COPY packages/api/pyproject.toml packages/api/uv.lock ./
COPY packages/geo-audit ../geo-audit

ARG INSTALL_CRAWL=1
RUN set -eux; \
    if [ "$INSTALL_CRAWL" = "1" ]; then \
      uv sync --no-dev --extra crawl; \
      uv run playwright install --with-deps chromium; \
    else \
      uv sync --no-dev; \
    fi

COPY packages/api/app ./app
COPY packages/api/alembic ./alembic
COPY packages/api/alembic.ini ./

EXPOSE 8000

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
