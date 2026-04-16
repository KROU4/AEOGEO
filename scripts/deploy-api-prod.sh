#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST (example: root@1.2.3.4)}"
: "${DEPLOY_PATH:=/opt/aeogeo}"
: "${SSH_KEY:=}"

SSH_OPTS=()
if [[ -n "${SSH_KEY}" ]]; then
  SSH_OPTS=(-i "${SSH_KEY}")
fi

RSYNC_SSH=(ssh "${SSH_OPTS[@]}")

echo "Syncing backend artifacts to ${DEPLOY_HOST}:${DEPLOY_PATH} ..."
rsync -avz --delete \
  --exclude ".venv" \
  --exclude "__pycache__" \
  --exclude ".pytest_cache" \
  --exclude "node_modules" \
  -e "${RSYNC_SSH[*]}" \
  docker-compose.prod.yml \
  packages/api \
  packages/geo-audit \
  "${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "Rebuilding api + worker ..."
ssh "${SSH_OPTS[@]}" "${DEPLOY_HOST}" \
  "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml up -d --build api temporal-worker"

echo "Running migrations ..."
ssh "${SSH_OPTS[@]}" "${DEPLOY_HOST}" \
  "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml exec -T api uv run alembic upgrade head"

echo "API deploy complete."
