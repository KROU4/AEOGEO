# Локальная разработка в Docker (см. docker-compose.yml → сервис `web`).
#
# Контекст сборки — корень монорепозитория:
#   docker build -f packages/web/Dockerfile .
#
# Vite должен слушать 0.0.0.0, иначе порт не пробросится из контейнера.
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/package.json
COPY packages/web/package.json ./packages/web/package.json

RUN bun install --frozen-lockfile || bun install

COPY packages/web ./packages/web

WORKDIR /app/packages/web
EXPOSE 5173
# Аргументы после -- передаются в vite (см. packages/web/package.json → "dev": "vite")
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
