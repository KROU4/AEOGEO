# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

AEO/GEO AI Visibility CRM platform. Helps clients get cited, recommended, and accurately represented by AI answer engines (ChatGPT, Gemini, Perplexity, Claude, etc.).

Core loop: measure AI visibility → generate/publish AI-readable content → moderate → re-measure and optimize.

## Monorepo structure

- `packages/api/` — FastAPI backend (Python 3.12, uv)
- `packages/web/` — React + Vite frontend (TypeScript, bun)
- `packages/widget/` — Embeddable widget (vanilla TS, Vite library mode, Shadow DOM)
- Root uses bun workspaces

## Development

**Production** is still validated on the VPS per deploy scripts below.

**Local stack (optional):** `docker compose up --build` from the repo root — Postgres (pgvector), Redis, Temporal (+ UI), API, web, temporal-worker. Copy `compose.env.example` → `.env` for ports; ensure `packages/api/.env` exists. Compose sets `DATABASE_URL` / `REDIS_URL` to Docker service names (`db`, `redis`), overriding `localhost` from `.env`. See `docs/RAILWAY.md` for cloud deploy on Railway.

## Common commands

```bash
# Frontend
cd packages/web && bun run lint          # ESLint
cd packages/web && bun run typecheck     # tsc --noEmit
cd packages/web && bun run test          # vitest run
cd packages/web && bun run build         # vite build (also builds widget first)
cd packages/web && bun run generate:types # Generate TS types from OpenAPI spec

# Backend
cd packages/api && uv run ruff check .   # Lint
cd packages/api && uv run ruff format .  # Format
cd packages/api && uv run mypy app/      # Type checking (strict mode)
cd packages/api && uv run pytest         # Tests (only 3 test files exist in tests/)

# Widget
cd packages/widget && bun run build      # → dist/widget.js

# Migrations (run on VPS via SSH)
ssh -i ~/.ssh/YOUR_SSH_KEY root@YOUR_SERVER_IP \
  "cd /opt/aeogeo && docker compose -f docker-compose.prod.yml exec api uv run alembic upgrade head"

# New migration
cd packages/api && uv run alembic revision --autogenerate -m "description"
```

## Deployment

**Frontend**: `./scripts/deploy-web-prod.sh` — rsyncs web + widget to VPS, rebuilds Docker container.

**API**:
```bash
rsync -avz --exclude '.venv' --exclude '__pycache__' -e "ssh -i ~/.ssh/YOUR_SSH_KEY" packages/api/ root@YOUR_SERVER_IP:/opt/aeogeo/packages/api/
rsync -avz -e "ssh -i ~/.ssh/YOUR_SSH_KEY" docker-compose.prod.yml root@YOUR_SERVER_IP:/opt/aeogeo/
ssh -i ~/.ssh/YOUR_SSH_KEY root@YOUR_SERVER_IP "cd /opt/aeogeo && docker compose -f docker-compose.prod.yml up -d --build api temporal-worker"
```

- **Frontend**: https://sand-source.com (127.0.0.1:8030)
- **API**: https://api.sand-source.com (127.0.0.1:8020)
- **VPS**: YOUR_SERVER_IP, SSH key: `~/.ssh/YOUR_SSH_KEY`, server path: `/opt/aeogeo/`

After making changes, always deploy to prod. Never stop at local edits. After deploying, push to main.

## Architecture

### Request flow

**Backend**: Router (`app/routers/`) → Service (`app/services/`) → DB via async SQLAlchemy session. All routers mount under `/api/v1`. FastAPI dependency injection provides `get_db` (async session), `get_current_user` (Clerk JWT verification → local User lookup), and `get_system_admin` (admin role check) from `app/dependencies.py`.

**Frontend**: Route component (`src/routes/`) → TanStack Query hook (`src/hooks/use-*.ts`) → API client (`src/lib/api-client.ts`) → `fetch()` with Bearer token. Auth tokens come from Clerk via `src/lib/auth.ts` (cached 50s). The API client auto-redirects to `/login` on 401.

**Auth**: Clerk handles authentication. Frontend gets session tokens from `@clerk/react`, backend verifies them via Clerk JWKS in `app/services/clerk.py`. The `get_current_user` dependency resolves Clerk identity to a local `User` row.

### Background processing

Temporal orchestrates long-running pipelines. Task queue: `aeogeo-pipeline`. Worker entry point: `app/workflows/worker.py`. Key workflow chain: `FullPipelineWorkflow` → `RunEngineWorkflow` → `ParseAnswersWorkflow` → `ScoreRunWorkflow`. All workflows and activities must be registered in `worker.py`.

### Database

PostgreSQL + pgvector. Async engine via `asyncpg`. Models in `app/models/`, base classes (`Base`, `UUIDMixin`, `TimestampMixin`) in `app/models/base.py`.

**Import order in `app/models/__init__.py` matters**: forward-ref targets (Product, Competitor, KnowledgeEntry) must be imported before models that reference them (Brand, Project). Breaking this order causes SQLAlchemy relationship resolution failures.

Alembic migrations in `packages/api/alembic/versions/`. The `env.py` uses `DATABASE_URL` env var when set, falls back to `alembic.ini`.

### Config

Backend config: `app/config.py` using `pydantic-settings` with `.env` file. Key env vars: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `ENCRYPTION_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Frontend: `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`.

### Frontend patterns

- **Routing**: TanStack Router, file-based in `src/routes/`. Dashboard layout at `_dashboard.tsx`, all app pages nested under `/_dashboard/`.
- **UI**: shadcn/ui components, Tailwind CSS v4, light (stone + teal) + dark theme.
- **i18n**: react-i18next with English (`en`) and Russian (`ru`). JSON namespaces in `src/i18n/locales/{en,ru}/`. Russian plurals use `_one`/`_few`/`_many` suffixes. Persisted in localStorage key `aeogeo_locale`.
- **API types**: Generated from OpenAPI spec via `bun run generate:types`.

### Widget

Embeddable vanilla TypeScript, Shadow DOM for CSS isolation. Renderers: FAQ (accordion), Blog Feed (cards). Optional JSON-LD injection. Build: `cd packages/widget && bun run build` → `dist/widget.js`.

### Seeded data

`uv run python -m app.seed` creates: default tenant, admin user (`admin@email.com` / `password123!`), 3 roles with 14 permissions, tenant quota, 6 AI engines, 6 content templates.

## Key tech stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy 2.0 async, asyncpg, pgvector |
| Auth | Clerk (JWT via JWKS), `@clerk/react` frontend |
| Orchestration | Temporal (task queue: `aeogeo-pipeline`) |
| Embeddings | OpenAI `text-embedding-3-large` (3072 dims) |
| Frontend | React 18, TanStack Router + Query v5, Vite 6 |
| UI | shadcn/ui, Tailwind CSS v4, Recharts, Lucide icons |
| i18n | react-i18next (en, ru) |
| Crawling | Crawl4AI + Playwright |
| AI keys | Fernet encryption (`app/services/ai_key.py`) |

## What needs to be built next

1. Content audit loop (automated re-runs 48h after content publication)
2. Before/after attribution (map content pushes to score deltas)
3. Self-serve registration + onboarding
4. Billing integration
5. More engines (Meta AI, etc.)
6. Referral program (Tolt integration)
