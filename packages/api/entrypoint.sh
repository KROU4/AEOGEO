#!/bin/sh
set -e

PORT="${PORT:-8000}"

if [ "${SKIP_ALEMBIC:-0}" != "1" ]; then
  uv run alembic upgrade head
fi

exec uv run uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --no-access-log
