#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_PATH="${REMOTE_PATH:-/opt/aeogeo}"
SSH_KEY="${SSH_KEY:?Set SSH_KEY (path to your private key)}"

cd "$ROOT_DIR"

ssh -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" \
  "mkdir -p ${REMOTE_PATH}/packages/web ${REMOTE_PATH}/packages/api ${REMOTE_PATH}/packages/widget"

rsync -az -e "ssh -i $SSH_KEY" \
  ./package.json \
  ./bun.lock \
  ./docker-compose.prod.yml \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.tanstack' \
  --exclude 'tsconfig.tsbuildinfo' \
  -e "ssh -i $SSH_KEY" \
  ./packages/web/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/packages/web/"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  -e "ssh -i $SSH_KEY" \
  ./packages/widget/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/packages/widget/"

rsync -az -e "ssh -i $SSH_KEY" \
  ./packages/api/package.json \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/packages/api/package.json"

ssh -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" \
  "cd ${REMOTE_PATH} && docker compose -f docker-compose.prod.yml up -d --build web && docker compose -f docker-compose.prod.yml ps web"
