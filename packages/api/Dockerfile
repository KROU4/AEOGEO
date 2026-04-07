FROM python:3.12-slim AS base

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml ./

RUN uv sync --no-dev

# Install Chromium for Crawl4AI website crawling
RUN uv run playwright install --with-deps chromium

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
