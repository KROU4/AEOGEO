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

echo "Syncing web artifacts to ${DEPLOY_HOST}:${DEPLOY_PATH} ..."
rsync -avz --delete \
  -e "${RSYNC_SSH[*]}" \
  docker-compose.prod.yml \
  package.json \
  bun.lock \
  packages/web \
  packages/api/package.json \
  "${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "Rebuilding web container ..."
ssh "${SSH_OPTS[@]}" "${DEPLOY_HOST}" \
  "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml up -d --build web"

echo "Web deploy complete."
