FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/package.json
COPY packages/web/package.json ./packages/web/package.json
COPY packages/widget/package.json ./packages/widget/package.json

RUN bun install --frozen-lockfile || bun install

COPY packages/web ./packages/web
COPY packages/widget ./packages/widget

WORKDIR /app/packages/web
EXPOSE 5173
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]