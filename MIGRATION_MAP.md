# Migration map — AVOP prompt vs current AEOGEO prototype

Generated from codebase review (2026-04-15). Use this as the working checklist for the [cursor-webapp-prompt.md](./cursor-webapp-prompt.md) migration.

## Repo layout

| Prompt target | Current repo | Decision |
|---------------|--------------|----------|
| `apps/api`, `apps/web`, `apps/widget` | `packages/api`, `packages/web`, `packages/widget` (bun workspaces) | **Keep current layout** unless a full rename is planned; behavior and CI matter more than folder names. Optional later rename to `apps/` for parity with the prompt. |
| `packages/geo-audit` | Does not exist | **New package** — wrapper around [geo-seo-claude](https://github.com/zubair-trabzada/geo-seo-claude). |
| Root `docker-compose.yml` for local dev | Production-focused workflow in [CLAUDE.md](./CLAUDE.md) | Prompt’s compose stack is valid for **optional** local work; repo policy says prod VPS testing — align team expectations before relying on local Docker. |

## KEEP (verified in tree)

- **FastAPI async + SQLAlchemy 2 + asyncpg**, Alembic, `pgvector`-style models (embedding dimensions may differ from prompt’s 1536 example).
- **Redis** usage (e.g. public widget rate limits).
- **Temporal** worker and workflow chain: `FullPipelineWorkflow` → `RunEngineWorkflow` → `ParseAnswersWorkflow` → `ScoreRunWorkflow` (see `packages/api/app/workflows/`).
- **Clerk JWT** — `get_current_user`, `ClerkIdentity`, `AuthService.bootstrap_clerk_user`.
- **Multi-tenancy** — `Tenant`, `User`, `Project`, RBAC (roles/permissions).
- **Pipeline core** — engine connectors, runs, answers, `ParseRunnerService` / parsing, `ScoringService` and `VisibilityScore` aggregates.
- **Ingestion / knowledge / content** — ingestion workflow, content factory, queries, recommendations as implemented in prototype.
- **Reports** — `ReportGeneratorService` and related routers.
- **Frontend** — React, TanStack Router/Query, i18n `en`/`ru`, OpenAPI codegen, widget Shadow DOM build.

## DISCARD or shrink

| Item | Status | Action |
|------|--------|--------|
| `VisibilityService` (`packages/api/app/services/visibility.py`) | **Not imported** anywhere outside its file; dashboard uses **`dashboard` router** with real SQL aggregates | Safe to **delete** after confirming no dynamic imports; dashboard already serves `/api/v1/dashboard/*` from DB. |
| `crawl_engine_activity` | `NotImplementedError` in `activities.py` | Prompt: leave stub or remove from registration — **do not build** until product needs it. |
| `ingest_document_activity` | Same | Same. |
| Seed data | `app/seed` exists | Prompt wants onboarding-driven data — **replace gradually**, not a blind delete until onboarding ships. |
| Demo / mock layers | TBD grep per feature | Remove mocks as endpoints are wired to real pipeline data. |

## Already implemented vs prompt API sketch

| Prompt | Current |
|--------|---------|
| `GET /auth/me` | **`GET /api/v1/auth/me`** — returns user + permissions (not full “tenant + projects” in one payload; projects via `/projects`). |
| `POST /auth/webhook` (Clerk) | **Missing** — tenant/user creation uses **`POST /api/v1/auth/bootstrap`** with `get_clerk_identity`. Add webhook if you need server-driven signup sync. |
| `POST /audit/quick` (public) | **Missing** — needs `GeoAuditService` + optional `PublicAudit` table. |
| `POST /projects/{id}/runs` | Covered by runs/schedules API (verify paths in `runs.py` / workflows). |
| Dashboard aggregates | **`/api/v1/dashboard/*`** + **`/api/v1/projects/.../scores/*`** — real DB metrics; **not** `VisibilityService`. |

## NEW work (priority order — matches prompt “First task”)

1. **`packages/geo-audit`** (or equivalent) wrapping geo-seo-claude; **`QuickAuditResult`** schema + **`POST /api/v1/audit/quick`** (public, no JWT).
2. **`PublicAudit`** (or similar) model + migration — store quick audit for lead gen + link after signup.
3. Optional **Clerk webhook** if bootstrap-only flow is insufficient for marketing site automation.
4. **Frontend** — landing URL input → quick audit; era.shopping-style theme and route split (`/dashboard/visibility`, …) as incremental refactors; i18n already exists under `src/i18n/locales/` (prompt mentions `public/locales/` — align to one convention).
5. **`ScheduledRunWorkflow`** — cron per project (prompt addition).

## Design / UX gap

- Prompt specifies **era.shopping** dark tokens (e.g. `#0F0F11`, cyan accent) and **Geist + Syne**. Current app uses the documented **stone + teal** theme — treat as a **visual migration** milestone, not a backend blocker.

## Embedding dimension note

Prompt example uses `vector(1536)`; prototype may use **`text-embedding-3-large` (3072)** per [CLAUDE.md](./CLAUDE.md). Keep one embedding model per environment and reflect it in models/migrations.

---

**Next concrete commits:** delete dead `VisibilityService`, add `geo-audit` package + `/audit/quick` + `PublicAudit` migration, then iterate on webhook and UI theme.
