# AVOP — Surgical Refactoring Prompt
## Based on full codebase audit. Remove everything outside product scope. Wire everything that's left.

> Cursor Agent, режим: **REFACTOR**. Читай каждую секцию последовательно. Не пиши новый код пока не удалишь старый. Работай блоками.

---

## CONTEXT — ЧТО ТАКОЕ AVOP

AVOP — платформа AI visibility analytics. Пользователь добавляет свой сайт, AVOP опрашивает ChatGPT / Perplexity / Gemini / Google AI с релевантными запросами и измеряет, насколько часто и как его бренд появляется в ответах. На выходе — метрики, AI-ассистент с объяснениями и рекомендации что исправить.

**Полный список экранов продукта:**
1. Лендинг (публичный) — URL-аудит как лид-магнит
2. Auth (Clerk): login / register / complete-signup / accept-invite
3. Онбординг: добавить бренд → добавить конкурентов → первый запуск анализа
4. Dashboard / Overview — AI Assistant widget + 4 метрики + SoV donut + platform table + trends
5. Visibility — детальная страница SoV, breakdown, тренды
6. Citations — таблица источников, которые цитируют ИИ
7. Competitors — сравнение брендов по платформам
8. Platforms — per-platform deep dive (ChatGPT / Perplexity / Gemini / Google AI)
9. AI Assistant — полный стриминговый отчёт + чат
10. Reports — список + генерация PDF
11. Settings — аккаунт, проект, команда, API-ключи
12. Projects CRUD

**Всё остальное — вне продукта.** Смотри блок УДАЛИТЬ ниже.

---

## БЛОК 1 — УДАЛИТЬ (backend)

Следующие файлы и всё что они тянут — удалить полностью. После удаления каждого файла проверь что нет разбитых импортов.

### 1.1 Content-система (не входит в AVOP)
```
packages/api/app/routers/content.py
packages/api/app/routers/templates.py
packages/api/app/services/content.py
packages/api/app/services/content_factory.py
packages/api/app/services/content_audit.py
packages/api/app/workflows/content_audit.py        # ContentAuditWorkflow
packages/api/app/models/content.py                 # Content, ContentTemplate models
```
В `app/main.py` — убрать include_router для content и templates роутеров.
В `worker.py` — убрать регистрацию `find_auditable_content_activity`, `trigger_audit_run_activity` если они только для ContentAuditWorkflow.
В Alembic — НЕ трогать миграции (не откатывать), просто игнорировать таблицы.

### 1.2 Widget-система (не входит в AVOP)
```
packages/api/app/routers/widgets.py
packages/api/app/services/widget.py
packages/api/app/models/widget.py                  # Widget, WidgetEvent
packages/widget/                                    # весь пакет виджета
```
В `app/main.py` — убрать widget роутер.
В `packages/web/src/routes/embed.$embedToken.tsx` — удалить.

### 1.3 Knowledge base / Ingestion (не входит в AVOP)
```
packages/api/app/routers/knowledge.py
packages/api/app/services/knowledge.py
packages/api/app/services/ingestion.py
packages/api/app/models/knowledge.py               # KnowledgeEntry, CustomFile
packages/api/app/workflows/ingestion.py            # IngestionWorkflow
```
В `worker.py` — убрать `crawl_website_activity`, `extract_knowledge_activity`, `generate_embeddings_activity` если они только для IngestionWorkflow. Проверь зависимости — если ничто другое их не вызывает.
В `app/main.py` — убрать knowledge роутер.
В `packages/web/src/routes/` — удалить `projects_.$projectId_.knowledge.tsx`.

### 1.4 Analytics integrations (GA4, Yandex Metrica — не в скоупе MVP)
```
packages/api/app/routers/analytics.py
packages/api/app/routers/attribution.py
packages/api/app/services/analytics.py
packages/api/app/services/traffic_sync.py
packages/api/app/services/ga4_client.py
packages/api/app/services/yandex_metrica_client.py
packages/api/app/models/analytics.py              # AnalyticsIntegration, TrafficSnapshot
```
В `app/main.py` — убрать эти роутеры.
**Важно:** В `packages/web/src/routes/_dashboard/overview.tsx` проверь хуки `useTrafficData` и любые GA4-related импорты — убрать их из Overview, заменить пустым состоянием если нужно.

### 1.5 Feedback (не входит в AVOP MVP)
```
packages/api/app/routers/feedback.py
packages/api/app/services/feedback.py
packages/api/app/models/feedback.py               # FeedbackEntry
```
В `app/main.py` — убрать роутер.

### 1.6 Dead activities (никогда не будут работать)
В `packages/api/app/workflows/activities.py` — удалить тела функций `crawl_engine_activity` и `ingest_document_activity` (оставь только `pass` или удали полностью вместе с определением). Они уже не зарегистрированы в worker.

### 1.7 Billing — заменить заглушку честным stub
В `packages/api/app/routers/billing.py` — **не удалять**, но изменить:
```python
# Было: hardcoded {"plan": "free", "usage": {...}}
# Стало: честный ответ из DB tenant quota
@router.get("/billing/plan")
async def get_billing_plan(user = Depends(get_current_user), db = Depends(get_db)):
    from app.services.usage import UsageService
    summary = await UsageService(db).get_quota_status(user.tenant_id)
    return {
        "plan": user.tenant.plan if hasattr(user.tenant, 'plan') else "free",
        "quota": summary
    }
```
Если `plan` нет в модели `Tenant` — добавь поле `plan: str = "free"` с дефолтом.

---

## БЛОК 2 — УДАЛИТЬ (frontend routes)

В `packages/web/src/routes/` удалить следующие файлы:

```
_dashboard/content.tsx               # content management
_dashboard/widgets.tsx               # widget system
projects_.$projectId_.knowledge.tsx  # knowledge base
embed.$embedToken.tsx                # widget embed
admin/ai-keys.tsx                    # упростим - оставить только в settings
admin/ai-usage.tsx
admin/ai-usage.$tenantId.tsx
```

В `packages/web/src/` — убрать из сайдбара и навигации все ссылки на удалённые роуты.

**Оставить, но проверить:**
```
shared.reports.$shareToken.tsx       # нужен — публичный доступ к report по ссылке
_dashboard/projects.$projectId.tsx   # нужен — настройки конкретного проекта
projects.$projectId.runs.tsx         # нужен — история запусков
projects.$projectId.answers.tsx      # нужен — просмотр AI ответов
projects.$projectId.queries.tsx      # нужен — управление запросами для pipeline
```

---

## БЛОК 3 — УПРОСТИТЬ (не удалять, но облегчить)

### 3.1 Keywords router
`packages/api/app/routers/keywords.py` — **оставить**, но убедиться что он используется только внутри онбординга/настроек проекта для seed-queries. Ключевые слова нужны как входные данные для `QueryAgentService` при генерации запросов. Если UI для keywords уже встроен в проект-настройки — ок.

### 3.2 Brand autofill / Discovery
`packages/api/app/services/discovery.py` + `POST /brand/autofill` — **оставить**, используется в онбординге для автозаполнения бренда по домену. Убедиться что вызов работает.

### 3.3 Admin AI keys
`/admin/ai-keys` роут из сайдбара убрать (это не для обычных пользователей), но **сам backend роутер оставить** — он нужен владельцам для управления ключами через API. Добавить в Settings страницу раздел "API Keys" если его нет.

### 3.4 Roles / RBAC
`packages/api/app/routers/roles.py` и `services/role.py` — **оставить**, используются для team management в Settings.

---

## БЛОК 4 — ПРОВЕРИТЬ И ДОФИКСИТЬ (core flows)

После удаления лишнего — пройди по каждому из этих эндпоинтов и убедись что они работают:

### 4.1 Quick Audit (Landing → Preview card)
```
POST /api/v1/audit/quick
```
- Вызывает `GeoAuditService.run_quick_audit(url)` — **native path** (без `GEO_SEO_CLAUDE_HOME`)
- Создаёт запись `PublicAudit` в DB
- Возвращает `QuickAuditResult` с полями: `overall_geo_score`, `citability_score`, `ai_crawler_access` (4 бота), `has_llms_txt`, `schema_org`, `top_issues`, `top_recommendations`, `audit_id`
- Rate limit: 5/час/IP через Redis

**Проверь:** `PATCH /api/v1/audit/quick/{audit_id}/email` тоже существует.

### 4.2 Dashboard metrics (Overview page)
```
GET /api/v1/projects/{id}/dashboard
GET /api/v1/projects/{id}/dashboard/platforms
```
Эти два эндпоинта питают Overview страницу. Проверь что `project_dashboard_metrics.py` возвращает:
- `overall_score` + `overall_score_delta`
- `share_of_voice` + delta
- `avg_rank` + delta  
- `citation_rate` + delta
- `sparklines` (массив из 7 значений для мини-графиков на карточках)

Если `sparklines` нет — добавь в `build_project_dashboard()`.

### 4.3 AI Assistant (стриминг)
```
GET /api/v1/projects/{id}/assistant/summary    → SSE stream
GET /api/v1/projects/{id}/assistant/report     → SSE stream
POST /api/v1/projects/{id}/assistant/chat      → SSE stream
```
Все три в `project_assistant.py`. Проверь:
- Используют `StreamingResponse` с `media_type="text/event-stream"`
- `summary` — 2-3 предложения с реальными числами из последнего run
- `report` — 4-6 предложений (период + платформы + конкуренты + топ-действие)
- `chat` — получает `history` от клиента, держит контекст проекта

Если стриминг ломается (клиент получает всё разом) — проверь что нет `await response.body()` где-то в middleware.

### 4.4 Recommendations с категориями
```
GET /api/v1/projects/{id}/recommendations
```
Проверь что `RecommendationService` возвращает поле `category: "internal" | "external"`:
- `internal` = изменения на сайте клиента (robots.txt, schema, llms.txt)
- `external` = внешние действия (Reddit, статьи, PR)

Если поля нет — добавь логику: если recommendation связана с `geo-schema`, `geo-crawlers`, `geo-llmstxt` — это `internal`. Остальное — `external`.

### 4.5 Run status с per-engine stages
```
GET /api/v1/projects/{id}/runs/latest
```
Должен возвращать:
```json
{
  "run_id": "...",
  "status": "completed",
  "completed_at": "...",
  "stages": {
    "chatgpt": "completed",
    "perplexity": "completed", 
    "gemini": "pending",
    "google_ai": "running"
  },
  "progress_pct": 75
}
```
Если `stages` нет — добавь агрегацию из `EngineRun` записей: `status` per `engine` field.

### 4.6 SOV endpoint (Donut chart)
```
GET /api/v1/projects/{id}/sov?period=7d
```
Проверь что существует в `project_explorer.py` / `project_explorer_metrics.py`. Должен возвращать:
```json
{
  "brands": [
    { "domain": "client.com", "sov_pct": 23.7, "is_client": true },
    { "domain": "competitor.com", "sov_pct": 19.4, "is_client": false }
  ]
}
```
`is_client` = домен совпадает с `project.brand.domain`.

### 4.7 Competitors comparison
```
GET /api/v1/projects/{id}/competitors/comparison?period=7d
```
Проверь что `build_competitors` в `project_explorer_metrics.py` возвращает `by_platform` разбивку:
```json
{
  "brands": [{
    "domain": "...",
    "is_client": true,
    "overall_sov": 23.7,
    "by_platform": {
      "chatgpt": { "sov": 44.0, "rank": 2.1 },
      "perplexity": { "sov": 45.6, "rank": 2.6 }
    },
    "trend": [20, 21, 22, 23, 23.7]
  }]
}
```
Если `by_platform` нет — добавить агрегацию в сервис.

---

## БЛОК 5 — FRONTEND: убрать из UI то, что удалили из backend

### 5.1 Сайдбар (`AppSidebar`)
Финальная структура навигации:

```
ANALYTICS
  ├── Overview          /overview
  ├── Visibility        /visibility
  ├── Citations         /citations
  ├── Competitors       /competitors
  └── Platforms         /platforms

INTELLIGENCE
  ├── AI Assistant      /assistant
  └── Reports           /reports

SETTINGS
  └── Settings          /settings
```

Убрать из сайдбара: Content, Widgets, Knowledge, Admin.

### 5.2 Overview page — убрать traffic widgets
В `_dashboard/overview.tsx`:
- Убрать компоненты связанные с `useTrafficData`, GA4, Yandex
- Убрать "Traffic" секцию если она есть
- Оставить: AI Assistant widget (top), 4 metric cards, SoV donut, Platform table, Trends chart, Run status bar

### 5.3 Settings page — консолидировать
В `_dashboard/settings.tsx` должны быть табы:
- **Account** — имя, email, язык, пароль
- **Project** — домен, индустрия, конкуренты, частота запусков
- **Team** — инвайты, роли
- **API Keys** — просмотр/генерация ключей (перенести туда функционал из `/admin/ai-keys` для owner роли)
- **Billing** — текущий план, использование

Убрать: отдельные Admin роуты из сайдбара (если owner — покажи в Settings).

---

## БЛОК 6 — ФИНАЛЬНАЯ ПРОВЕРКА

После всех изменений выполни:

```bash
# 1. Проверь что API запускается без ошибок
cd packages/api && uv run python -m app.main  # или uvicorn

# 2. Проверь что нет broken imports
cd packages/api && uv run python -c "from app.main import app; print('OK')"

# 3. Проверь что worker запускается
cd packages/api && uv run python -m app.worker  # должен зарегистрировать workflows без ошибок

# 4. Проверь что фронт собирается
cd packages/web && npm run build

# 5. Quick smoke test API
curl -X POST http://localhost:8000/api/v1/audit/quick \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
# Должен вернуть QuickAuditResult с overall_geo_score
```

### Чеклист перед финишем:

- [ ] `app/main.py` — нет включённых роутеров для удалённых модулей
- [ ] `app/worker.py` — нет зарегистрированных активностей для удалённых workflow
- [ ] Сайдбар показывает ровно 8 пунктов (список выше)
- [ ] `GET /api/v1/projects/{id}/dashboard` возвращает `sparklines`
- [ ] `GET /api/v1/projects/{id}/assistant/summary` стримит SSE
- [ ] `GET /api/v1/projects/{id}/recommendations` возвращает `category` поле
- [ ] `GET /api/v1/projects/{id}/runs/latest` возвращает `stages`
- [ ] `GET /api/v1/billing/plan` возвращает реальные данные из `TenantQuota`
- [ ] `POST /api/v1/audit/quick` работает без `GEO_SEO_CLAUDE_HOME` (native path)
- [ ] Никаких `console.error` в браузере на Overview странице после удаления traffic хуков

---

## ИТОГ: что должно остаться

**Backend routers (итого ~20):**
auth, billing, projects, brands, keywords, queries, runs, schedules, engines, dashboard (project_dashboard_api), scores, recommendations, reports, audit (public), ai (complete), project_assistant, project_explorer, project_answers, roles, admin_keys (backend only), admin_usage (backend only), usage, public (shared reports)

**Backend services (итого ~25):**
auth, project, brand, keyword, query_agent, engine, engine_runner, engine_connector, parse_runner, scoring, report, report_generator, recommendation, ai_client, ai_key, ai_usage, ai_pricing, clerk, rate_limiter, scheduler, discovery, role, generate_pdf_report, project_dashboard_metrics, project_explorer_metrics, platform_queries_list, answer_highlights, geo_audit (в packages/geo-audit)

**Temporal workflows (итого 5):**
FullPipelineWorkflow, RunEngineWorkflow, ParseAnswersWorkflow, ScoreRunWorkflow, ScheduledRunWorkflow

**Frontend routes (итого ~20):**
/, /login, /register, /forgot-password, /reset-password, /complete-signup, /accept-invite, /new-project, /overview, /visibility, /citations, /competitors, /platforms, /assistant, /reports, /reports/$reportId, /settings, /projects, /projects/new, /projects/$projectId, /projects/$projectId/queries, /projects/$projectId/runs, /projects/$projectId/answers, /shared/reports/$shareToken
