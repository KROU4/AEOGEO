# CLAUDE.md

*Always AutoUpdate CLAUDE.MD*

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AEOGEO (Sand Source) is an AI visibility platform — it tracks how LLMs answer queries about a brand, runs GEO (Generative Engine Optimization) audits, and surfaces insights via a dashboard. It is an npm workspace monorepo containing three packages: a FastAPI backend, a React SPA, and a Python geo-audit utility library.

## Dev Commands

**Root (Bun):**
```bash
bun install                   # Install all workspace deps
bun run dev                   # Start API + Web concurrently
bun run dev:full              # Include Temporal worker
bun run lint                  # Web linting
bun run typecheck             # Web typecheck
```

**Web (`packages/web/`):**
```bash
bun run dev                   # Vite dev server on :5173
bun run build:strict          # TypeScript check + production build
bun run lint                  # ESLint 9 flat config
bun run typecheck             # tsc --noEmit
bun run test                  # Vitest unit tests
bun run test -- src/lib/onboarding-launch.test.ts   # Single file
bun run test:e2e              # Playwright (Chromium)
bun run test:e2e -- e2e/specific.spec.ts            # Single spec
```

**API (`packages/api/`):**
```bash
uv run uvicorn app.main:app --reload   # Dev server on :8000
uv run pytest -q                        # All tests
uv run pytest tests/test_cors.py       # Single file
uv run pytest tests/test_cors.py::test_cors_settings_check -v  # Single test
uv run ruff check .                    # Lint
uv run ruff format .                   # Format
uv run alembic upgrade head            # Run migrations
uv run python -m app.seed              # Seed DB
uv run python -m app.workflows.worker  # Temporal worker
```

## Architecture

```
packages/
├── api/          # FastAPI + SQLAlchemy 2 async + Temporal workflows
├── web/          # React 18 + Vite 6 + TanStack Router & Query
└── geo-audit/    # Python utility library (imported by API)
```

**Request flow:** Browser → Web SPA → API (Clerk JWT) → PostgreSQL/Redis. Long-running audit jobs go through Temporal workflows (async). The API auto-runs Alembic migrations on startup (skip with `SKIP_ALEMBIC=1`).

**Auth:** Clerk handles auth. The web sends `Authorization: Bearer <clerk-session-token>`. The API middleware validates the token and maps it to a local `User` record.

**API structure:** `app/routers/` (endpoints) → `app/services/` (business logic) → `app/models/` (SQLAlchemy ORM). Pydantic schemas live in `app/schemas/`. Temporal workflow definitions are in `app/workflows/`.

**Web routing:** TanStack Router with file-based routes under `src/routes/`. Data fetching uses TanStack Query v5. UI components are shadcn/ui (Radix + Tailwind v4).

## Environment

Three `.env` files are required — see the `.env.example` files at root, `packages/api/`, and `packages/web/`. Key variables:

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | root / api | PostgreSQL (asyncpg://) |
| `REDIS_URL` | root / api | Redis |
| `CLERK_SECRET_KEY` | api | JWT validation |
| `OPENAI_API_KEY` | api | LLM calls |
| `VITE_CLERK_PUBLISHABLE_KEY` | web | Clerk frontend |
| `VITE_API_URL` | web | Backend URL |

## Infrastructure

Local dev stack runs via Docker Compose (`docker-compose.yml`): api, web (nginx), db (PostgreSQL 16 + pgvector), redis. Add `--profile temporal` for the Temporal server + UI + worker.

Production: `docker-compose.prod.yml` with nginx reverse proxy.

CI (`.github/workflows/ci.yml`): three parallel jobs — web lint/typecheck/vitest, web Playwright e2e, API pytest.

## Key Conventions

- Python package managed with `uv`; never use `pip` directly.
- API tests use `FakeRedis` (via conftest.py fixture) — no real Redis needed for tests.
- Database URL format: the API normalizes `postgresql://` → `postgresql+asyncpg://` automatically.
- `geo-audit` is a local editable install (`uv pip install -e ../geo-audit`) — changes there are immediately reflected in the API.
