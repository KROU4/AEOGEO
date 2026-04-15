# Cursor Prompt — GEO Web App (Migration from Prototype + Greenfield Build)

> Вставь в Cursor как системный промпт в начале нового проекта. Работай в режиме Agent.

---

## CONTEXT & MISSION

You are building **AVOP** — a GEO (Generative Engine Optimization) SaaS platform. Users connect their website, and the platform tracks how often and how positively they appear in AI search answers from ChatGPT, Perplexity, Gemini, Google AI, and Claude.

We have an existing prototype (monorepo). Your job is to:
1. **Extract** all reusable, high-quality code from the prototype
2. **Rebuild** a clean, production-ready product using that foundation
3. **Integrate** the `geo-seo-claude` library as the audit engine core

The prototype has solid foundations but is partially incomplete. Extract what works. Discard stubs and dead code.

---

## STEP 0 — CODEBASE ANALYSIS (do this first)

Before writing any code, analyze the existing codebase and produce a `MIGRATION_MAP.md` with:

### What to KEEP from the prototype:

**Architecture & Infrastructure:**
- FastAPI async app with SQLAlchemy + PostgreSQL — keep as-is
- `pgvector` extension setup for embeddings
- Redis caching layer
- Temporal worker setup (FullPipelineWorkflow → RunEngineWorkflow → ParseAnswersWorkflow → ScoreRunWorkflow)
- Alembic migrations structure

**Auth & Multi-tenancy:**
- Clerk JWT verification middleware
- Tenant → User → Project RBAC model (roles/permissions)
- DB schema for tenants, users, projects

**Visibility Pipeline (core business logic — highest priority):**
- `engine_connector.py` — adapters for OpenAI Chat Completions, OpenRouter, etc.
- `RunEngineWorkflow` + `run_engine.py` — sends queries to AI engines, stores raw Answer
- `ParseAnswersWorkflow` + `ParseRunnerService` — LLM-based extraction of mentions/citations from answers
- `ScoreRunWorkflow` + `ScoringService` — computes VisibilityScore from parsed data
- Data models: `EngineRun → Answer → Mention/Citation → VisibilityScore`

**Content & Knowledge Pipeline:**
- `IngestionWorkflow` — Crawl4AI → LLM knowledge extraction → OpenAI embeddings → pgvector
- `ContentFactoryService` — LLM content generation with brand context
- `QueryAgentService` — generates industry-relevant queries for a brand
- `RecommendationService` — LLM-based recommendations from scoring results

**Reports:**
- `ReportGeneratorService` — pulls from EngineRun, VisibilityScore, Mention, content

**Frontend:**
- React + TanStack Router/Query setup
- i18n en/ru
- OpenAPI type generation pipeline
- Widget (vanilla TS, Shadow DOM) — keep as separate build

### What to DISCARD:

- `VisibilityService` — hardcoded stub, completely dead, NOT wired to any router. Delete it.
- `crawl_engine_activity` — `NotImplementedError`, not part of current flow
- `ingest_document_activity` — `NotImplementedError`, not implemented
- All seed data (app/seed/) — replace with proper onboarding flow
- Any mock data in demo layers

---

## STEP 1 — PROJECT STRUCTURE

Set up a clean monorepo:

```
/
├── apps/
│   ├── api/              # FastAPI backend
│   │   ├── app/
│   │   │   ├── api/      # Routers (v1)
│   │   │   ├── core/     # Config, DB, auth, Clerk middleware
│   │   │   ├── models/   # SQLAlchemy models
│   │   │   ├── schemas/  # Pydantic schemas
│   │   │   ├── services/ # Business logic (migrated from prototype)
│   │   │   └── workers/  # Temporal workflows + activities
│   │   ├── alembic/
│   │   └── pyproject.toml
│   ├── web/              # React frontend (dashboard)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── lib/      # API client (generated from OpenAPI)
│   │   └── package.json
│   └── widget/           # Vanilla TS embed widget
├── packages/
│   └── geo-audit/        # Wrapper around geo-seo-claude library
├── docker-compose.yml    # PostgreSQL + Redis + Temporal
└── .env.example
```

---

## STEP 2 — BACKEND (FastAPI)

### Tech Stack:
- Python 3.12
- FastAPI (async)
- SQLAlchemy 2.0 async + asyncpg
- PostgreSQL 16 + pgvector
- Redis (aioredis)
- Temporal (Python SDK)
- Clerk SDK for Python (JWT verification)
- Pydantic v2

### Database Models (migrate from prototype, clean up):

```python
# Core models to have:
Tenant(id, name, plan, created_at)
User(id, tenant_id, clerk_user_id, role, email)
Project(id, tenant_id, name, domain, config_json)
QuerySet(id, project_id, queries: list[str], industry, created_at)
EngineRun(id, project_id, engine: str, status, started_at, completed_at)
Answer(id, run_id, query: str, engine: str, raw_text, created_at)
Mention(id, answer_id, brand_mentioned: str, position: int, sentiment: float)
Citation(id, answer_id, url: str, domain: str, is_client_domain: bool)
VisibilityScore(id, run_id, project_id, engine: str, sov: float, avg_rank: float, citation_rate: float, sentiment_avg: float, computed_at)
KnowledgeChunk(id, project_id, content: str, embedding: vector(1536), source_url: str)
ContentItem(id, project_id, type: str, content_json, published_at)
```

### API Routers (v1):

**Auth & Onboarding:**
- `POST /auth/webhook` — Clerk webhook: create Tenant + User on signup
- `GET /auth/me` — return current user + tenant + projects

**Projects:**
- `POST /projects` — create project (brand domain, name, industry, competitors list)
- `GET /projects` — list user's projects
- `GET /projects/{id}` — project detail

**Audit (Lead Gen + Authenticated):**
- `POST /audit/quick` — **PUBLIC endpoint** (no auth). Takes `{url: string}`. Runs geo-seo-claude library against the URL, returns a mini GEO score (citability score, AI crawler access, has llms.txt, has schema.org markup). Used by the landing page input widget.
- `POST /projects/{id}/runs` — trigger full FullPipelineWorkflow for a project
- `GET /projects/{id}/runs` — list runs with status

**Dashboard:**
- `GET /projects/{id}/dashboard` — aggregate: latest VisibilityScore per engine, SoV%, avg rank, trend data (last 12 weeks)
- `GET /projects/{id}/competitors` — SoV comparison: client vs competitors
- `GET /projects/{id}/citations` — top cited sources per engine
- `GET /projects/{id}/platforms` — per-platform breakdown (ChatGPT, Perplexity, Gemini, Google AI)

**Content:**
- `GET /projects/{id}/recommendations` — LLM-generated action items
- `POST /projects/{id}/content/generate` — trigger content generation
- `GET /projects/{id}/reports/latest` — download PDF report

### Clerk Middleware:
```python
# All /api/v1/* except /audit/quick require Clerk JWT
# Extract tenant_id from JWT claims → scope all queries
```

---

## STEP 3 — GEO AUDIT ENGINE INTEGRATION

Install and wrap the `geo-seo-claude` library from https://github.com/zubair-trabzada/geo-seo-claude

Create `packages/geo-audit/geo_audit_service.py`:

```python
class GeoAuditService:
    async def run_quick_audit(self, url: str) -> QuickAuditResult:
        """
        Used by the public /audit/quick endpoint (landing page lead gen).
        Returns:
        - overall_geo_score: float (0-100)
        - citability_score: float
        - ai_crawler_access: dict[engine, bool]  # PerplexityBot, ClaudeBot, GPTBot
        - has_llms_txt: bool
        - schema_org: dict  # which schemas are present
        - top_issues: list[str]  # max 5 critical issues
        - top_recommendations: list[str]  # max 3 quick wins
        """
        # Call geo-seo-claude CLI or Python API
        # Parse output into QuickAuditResult

    async def generate_llms_txt(self, project: Project) -> str:
        """Generate llms.txt content based on project brand info"""

    async def generate_schema_markup(self, project: Project) -> dict:
        """Generate Organization + FAQ Schema.org JSON-LD"""
```

The `QuickAuditResult` should be stored in a `PublicAudit` table with the email (captured after showing results on landing page) for lead gen CRM purposes.

---

## STEP 4 — TEMPORAL WORKFLOWS (migrate from prototype)

Keep the exact workflow chain from the prototype:

```
FullPipelineWorkflow
  └── RunEngineWorkflow        # query AI engines, store Answer rows
  └── ParseAnswersWorkflow     # extract Mention + Citation from Answers
  └── ScoreRunWorkflow         # compute VisibilityScore
```

Additionally add:
```
IngestionWorkflow              # crawl site → extract knowledge → embeddings (already in prototype)
ScheduledRunWorkflow           # weekly cron trigger per project
```

**Do NOT implement:**
- `crawl_engine_activity` (keep as NotImplementedError)
- `ingest_document_activity` (keep as NotImplementedError)

---

## STEP 5 — FRONTEND (React Dashboard)

### Tech Stack:
- React 18 + TypeScript
- TanStack Router (file-based routing)
- TanStack Query (server state)
- Tailwind CSS
- Recharts (for all charts)
- Clerk React SDK (auth)
- shadcn/ui components
- i18n: react-i18next (en + ru) — **both locales must be fully translated**
  - Translation files: `public/locales/en/common.json` + `public/locales/ru/common.json`
  - Language switcher component in top navbar (EN / RU toggle)
  - All dashboard labels, metric names, status strings, recommendation text in both languages
  - Default: detect from `navigator.language`, persist in localStorage
  - API responses are language-agnostic (brand names, numbers); only UI strings are translated

### Design Language:

Follow the **era.shopping** dashboard aesthetic:
- Background: `#0F0F11` (near-black)
- Sidebar: `#141417` with `1px` right border
- Cards: `#1A1A1F` with `border: 1px solid rgba(255,255,255,0.06)`
- Accent/primary: `#06B6D4` (cold cyan)
- Text primary: `#F1F1F3`
- Text muted: `#71717A`
- Positive trend: `#22C55E`
- Negative trend: `#EF4444`
- Font: Geist (body) + Syne (headings/numbers)

### Routes & Pages:

```
/                          → redirect to /dashboard
/auth/sign-in              → Clerk SignIn component
/auth/sign-up              → Clerk SignUp component
/onboarding                → Add first project (domain, industry, competitors)
/dashboard                 → Overview (project selector at top)
/dashboard/visibility      → Share of Voice + Platform Ranking + Trends
/dashboard/citations       → Top cited URLs, domains, citation rate
/dashboard/competitors     → Competitor SoV comparison
/dashboard/platforms       → Per-platform deep dive
/dashboard/content         → Recommendations + generated content
/dashboard/reports         → PDF report download
/settings                  → Account, billing, API keys
```

### Dashboard Components (priority order):

**1. SoVDonut** — Recharts PieChart showing brand vs competitors' share of voice. Center: client brand + percentage. Legend: ranked list with % numbers.

**2. PlatformRankingTable** — Table: Platform | SoV% | Visibility% | Avg Rank. Rows: ChatGPT, Perplexity, Google AI, Gemini. Color-code rank: green if rank ≤ 3, yellow 4–7, red 8+.

**3. TrendsChart** — Recharts AreaChart. Dual line: Share of Voice + Visibility score. X-axis: weekly dates. Responsive.

**4. VisibilityBreakdown** — Horizontal bar chart: competitors listed top-to-bottom, bar width = SoV%. Client brand highlighted.

**5. MetricCards** (top row): Overall Visibility Score | Share of Voice | Avg Rank | Citation Rate — each with delta badge (↑ 12% vs last week).

**6. RecommendationsPanel** — Card list of LLM-generated action items. Each item: priority badge (High/Medium/Low) + title + 2-line description + "Mark Done" button.

**7. RunStatus** — Shows latest pipeline run status, last updated timestamp, "Trigger Manual Run" button.

---

## STEP 6 — LEAD GEN FLOW (landing page ↔ backend ↔ app)

1. User on landing page enters URL → `POST /api/v1/audit/quick`
2. Backend runs geo-seo-claude quick audit (30–60s), returns `QuickAuditResult`
3. Landing page shows a preview card with score + top 3 issues (blurred/teased)
4. To see full report: "Create free account" → Clerk sign-up → project auto-created from the audited URL → user lands in `/dashboard`
5. Full `FullPipelineWorkflow` triggered automatically on first project creation
6. `PublicAudit` record linked to new user in DB

---

## STEP 7 — DOCKER COMPOSE (local dev)

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: geo_app
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  temporal:
    image: temporalio/auto-setup:1.24
    ports: ["7233:7233"]

  temporal-ui:
    image: temporalio/ui:2.28
    ports: ["8080:8080"]
    environment:
      TEMPORAL_ADDRESS: temporal:7233
```

---

## STEP 8 — ENVIRONMENT VARIABLES

Generate `.env.example`:

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/geo_app
REDIS_URL=redis://localhost:6379

# Clerk
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# AI Engines
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
PERPLEXITY_API_KEY=pplx-...

# Temporal
TEMPORAL_HOST=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=geo-pipeline

# App
APP_ENV=development
API_BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

---

## CODING STANDARDS

- All backend endpoints must be async
- Use Pydantic v2 models for all request/response schemas
- Every router must scope DB queries by `tenant_id` (from Clerk JWT)
- Write Alembic migration for every model change
- Frontend: no `any` types, strict TypeScript
- All chart data must come from real DB queries (no mock data)
- Comment any TODO with estimated effort: `# TODO(phase-2): implement X — ~2h`

---

## FIRST TASK

After codebase analysis, start with:
1. `MIGRATION_MAP.md` — what's kept, what's discarded, what's new
2. Clean DB models (SQLAlchemy) + Alembic initial migration
3. Clerk middleware + `/auth/webhook` + `/auth/me`
4. `POST /audit/quick` endpoint + GeoAuditService wrapper
5. Run migrations, test the quick audit endpoint locally

Then proceed to the dashboard frontend.
