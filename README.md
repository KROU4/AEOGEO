# AEOGEO

> AI visibility platform for measuring how brands appear, get cited, and get recommended across answer engines.

## Live

- Web: https://sand-source.com
- API: https://api.sand-source.com
- API docs: https://api.sand-source.com/docs

## Architecture

```text
AEOGEO/
├── packages/
│   ├── api/      FastAPI backend, Temporal workflows, PostgreSQL, Redis
│   ├── web/      React + Vite dashboard and public embed host
│   └── widget/   Standalone widget bundle compiled to widget.js
├── docker-compose.yml
├── docker-compose.prod.yml
├── scripts/
│   └── deploy-web-prod.sh
└── README.md
```

## Current Product Surface

- Overview is project-aware. The dashboard overview now always resolves metrics and recent activity against a concrete project, with the last selection persisted locally.
- Onboarding can create first value immediately. The review step can now create a starter query set, generate starter visibility queries, approve them, and launch one run per selected engine.
- Widgets are delivered from the web host. Canonical embeds now use:
  - `https://sand-source.com/widget.js`
  - `https://sand-source.com/embed/{embed_token}`
- Public widget content is still served by the API at `/api/v1/public/widgets/{embed_token}/content`.
- Verification has a baseline now:
  - web lint
  - web typecheck
  - web smoke tests
  - api smoke tests
  - GitHub Actions CI in `.github/workflows/ci.yml`

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI, SQLAlchemy 2 async, PostgreSQL, Redis |
| Auth | Clerk session tokens plus local AEOGEO user/bootstrap records |
| Workflows | Temporal |
| Frontend | React 18, Vite, TanStack Router, TanStack Query |
| UI | shadcn/ui, Radix, Tailwind CSS v4, Lucide |
| Widget | TypeScript + Vite library build served as `widget.js` |
| Tooling | Bun, uv, Vitest, pytest, ESLint |
| Infra | Docker Compose, Nginx |

## Quick Start

### Prerequisites

- Bun 1.x
- Python 3.12+
- `uv`
- Docker
- Clerk publishable and secret keys

### 1. Configure env files

Use the example files as the base:

```bash
cp .env.example .env
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env
```

Minimum local auth configuration:

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `packages/web/.env`: `VITE_CLERK_PUBLISHABLE_KEY`
- `packages/api/.env`: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`

The web app will not render the authenticated dashboard without `VITE_CLERK_PUBLISHABLE_KEY`.

### 2. Start infrastructure

For full local end-to-end runs, include Temporal:

```bash
docker compose up -d db redis temporal temporal-ui
```

Useful local ports:

- API: `http://localhost:8000`
- Web: `http://localhost:5173`
- Temporal UI: `http://localhost:8233`

### 3. Install dependencies

```bash
bun install
cd packages/api && uv sync --dev && cd ../..
```

`bun install` covers the web app and the widget package.

### 4. Seed the database

```bash
cd packages/api
uv run python -m app.seed
cd ../..
```

Seeding creates:

- default tenant
- default roles and permissions
- default engines
- default content templates
- a local admin record

### 5. Run the app

```bash
bun run dev
```

The root dev command starts:

- API dev server
- widget watcher build
- web dev server

### 6. Run the Temporal worker

Immediate run execution depends on the worker:

```bash
cd packages/api
uv run python -m app.workflows.worker
```

If the worker or Temporal is unavailable, run records can still be created, but they will remain pending until retried or picked up later.

## Seeded Local Data

The seed script still creates a local admin user record:

```text
Email:    admin@email.com
Password: password123!
```

That record is useful for local RBAC/data seeding and backend development, but the web app itself signs users in through Clerk, not through the legacy email/password flow.

## Authentication Model

- The web app uses Clerk for sign-in and session management.
- The frontend requests a short-lived Clerk session token and sends it to the API as a Bearer token.
- The API verifies the Clerk token, then resolves or bootstraps a local AEOGEO user record.
- If a Clerk user exists but has not been bootstrapped locally yet, the dashboard redirects to `/complete-signup`.
- Local bootstrap happens through `POST /api/v1/auth/bootstrap`.

Key auth endpoints:

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/bootstrap`
- `POST /api/v1/auth/invite`
- `GET /api/v1/auth/team`
- `POST /api/v1/auth/logout`

## Main User Flows

### Project setup

1. Create a project and brand profile.
2. Optionally crawl the website and upload supporting files.
3. Add products and competitors.
4. On the review step:
   - finish setup later, or
   - start the first run immediately

### Starter first run

When the user clicks `Start First Run`, AEOGEO now:

1. Saves remaining products and competitors.
2. Creates `Starter Visibility Queries` if the project has no starter set yet.
3. Generates 10 starter visibility queries.
4. Auto-approves those starter queries.
5. Creates one run per selected active engine.

### Project overview

- Overview metrics require a project id.
- The dashboard resolves a default project automatically.
- Users can switch projects from the overview selector.
- The selected project is persisted in local storage.

### Widgets

Widgets support both JS and iframe delivery:

- JS:
  - `<script src="https://sand-source.com/widget.js" defer></script>`
- iframe:
  - `https://sand-source.com/embed/{embed_token}`

Public widget content is fetched from:

- `GET /api/v1/public/widgets/{embed_token}/content`

The dashboard embed-code endpoint:

- `GET /api/v1/widgets/{widget_id}/embed-code`

returns canonical token-based web-host URLs.

## Project Structure

### Backend

```text
packages/api/app/
├── config.py
├── dependencies.py
├── main.py
├── models/
├── routers/
│   ├── auth.py
│   ├── brands.py
│   ├── dashboard.py
│   ├── engines.py
│   ├── projects.py
│   ├── public.py
│   ├── queries.py
│   ├── runs.py
│   ├── widgets.py
│   └── ...
├── services/
├── schemas/
└── workflows/
    ├── full_pipeline.py
    ├── run_engine.py
    ├── parse_answers.py
    ├── score_run.py
    └── worker.py
```

### Frontend

```text
packages/web/src/
├── app.tsx
├── main.tsx
├── routes/
│   ├── _dashboard/
│   │   ├── overview.tsx
│   │   ├── widgets.tsx
│   │   ├── projects_.new.tsx
│   │   └── ...
│   └── embed.$embedToken.tsx
├── components/
├── hooks/
├── lib/
│   ├── onboarding-launch.ts
│   ├── overview-project.ts
│   └── widget-embed.ts
└── i18n/
```

### Widget package

```text
packages/widget/
├── src/
│   ├── api.ts
│   ├── widget.ts
│   ├── renderers/
│   └── styles/
└── dist/widget.js
```

`packages/web` builds `packages/widget` first, then copies the bundle into the web build output as `/widget.js`.

## Verification

Run the current verification set locally:

```bash
cd packages/web && bun run lint
cd packages/web && bun run typecheck
cd packages/web && bun run test
cd packages/web && bun run build

cd packages/api && uv run pytest
```

Notes:

- Web lint uses ESLint flat config in `packages/web/eslint.config.js`.
- Web smoke tests cover the new overview selection logic, onboarding launch orchestration, and widget embed URL generation.
- API smoke tests cover widget embed-code generation and public widget-content delivery.
- Repo-wide Ruff cleanup is still out of scope; only targeted tests are enforced in CI right now.

## Deployment

### Production services

- `web` serves the dashboard, public embed route, and `widget.js`
- `api` serves authenticated and public JSON APIs
- `temporal-worker` executes run pipelines

### Deploy web

```bash
./scripts/deploy-web-prod.sh
```

The deploy script syncs:

- `package.json`
- `bun.lock`
- `docker-compose.prod.yml`
- `packages/web/`
- `packages/widget/`
- `packages/api/package.json`

and then rebuilds the production `web` container on the VPS.

The production web build now includes:

- dashboard SPA assets
- public `/embed/{embed_token}` route
- `/widget.js`

### Deploy backend

```bash
rsync -avz --exclude '.venv' --exclude '__pycache__' --exclude 'node_modules' \
  -e "ssh -i ~/.ssh/YOUR_SSH_KEY" \
  packages/api/ root@YOUR_SERVER_IP:/opt/aeogeo/packages/api/

ssh -i ~/.ssh/YOUR_SSH_KEY root@YOUR_SERVER_IP \
  "cd /opt/aeogeo && docker compose -f docker-compose.prod.yml up -d --build api temporal-worker"
```

### Re-seed production database

```bash
ssh -i ~/.ssh/YOUR_SSH_KEY root@YOUR_SERVER_IP \
  "docker exec aeogeo-api-1 uv run python -m app.seed"
```

### Nginx

Nginx should reverse proxy:

- `sand-source.com` -> web container on `127.0.0.1:8030`
- `/api/` -> api container on `127.0.0.1:8020`

The existing production compose file already sets:

- web on `127.0.0.1:8030`
- api on `127.0.0.1:8020`

## Current Priorities

- Tenant-level aggregate analytics for overview and visibility pages
- More end-to-end widget publishing and feedback analytics
- Broader pytest coverage beyond the current smoke layer
- Targeted backend lint cleanup in touched modules
