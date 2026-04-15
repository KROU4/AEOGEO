# AVOP — Full-Stack Integration Plan
## Cursor Agent Prompt: Every UI element wired to a real backend endpoint

> Вставь в Cursor как системный промпт в режиме Agent. Цель — пройтись по каждому экрану Stitch-фронтенда и убедиться что каждая кнопка, метрика и таблица имеет реальный API-эндпоинт за собой.

---

## CORE ENGINE — geo-seo-claude

The analytical brain of AVOP is the `geo-seo-claude` library (`https://github.com/zubair-trabzada/geo-seo-claude`). It is already cloned and accessible. Every audit in AVOP ultimately runs through this engine.

**What the library does (its key scripts/modules):**

| Module | What it produces | AVOP use |
|--------|-----------------|----------|
| `scripts/citability_scorer.py` | Citability score 0–100, passage-level analysis | Overall GEO Score, per-page citability |
| `scripts/fetch_page.py` | Robots.txt parse, AI crawler access map | `ai_crawler_access` in QuickAuditResult |
| `scripts/brand_scanner.py` | Brand mentions on Reddit, YouTube, Wikipedia, LinkedIn | Brand authority signal in audit |
| `scripts/llmstxt_generator.py` | Generated llms.txt content | Recommendations → "Generate llms.txt" action |
| `scripts/generate_pdf_report.py` | PDF with score gauges, bar charts, action plan | Reports page PDF download |
| `agents/geo-ai-visibility.md` | Full AI visibility subagent (citability + crawlers + brands) | RunEngineWorkflow input |
| `agents/geo-platform-analysis.md` | Platform-specific readiness: ChatGPT / Perplexity / Google AIO / Gemini | Platforms page data |
| `agents/geo-schema.md` | Schema.org detection + JSON-LD generation | Recommendations: schema issues |
| `agents/geo-technical.md` | Technical SEO + Core Web Vitals | Technical sub-score |
| `agents/geo-content.md` | E-E-A-T, readability, freshness | Content quality sub-score |
| `schema/*.json` | JSON-LD templates (Organization, SaaS, Product, etc.) | Auto-generated markup for clients |

**Scoring weights (already defined in the library — preserve these exactly):**
```
AI Citability & Visibility  → 25%
Brand Authority Signals     → 20%
Content Quality & E-E-A-T   → 20%
Technical Foundations       → 15%
Structured Data             → 10%
Platform Optimization       → 10%
```

---

## TASK: INTEGRATION CHECKLIST

Go screen by screen. For each UI element, verify the backend contract exists, implement what's missing, and wire the frontend to real data. No mocks. No hardcoded values.

---

## SCREEN 1 — LANDING PAGE (public, no auth)

### 1.1 URL Audit Input (Hero + Final CTA)
**UI element:** User enters a URL → clicks "Audit now" → sees preview card with GEO score + issues.

**Backend contract:**
```
POST /api/v1/audit/quick
Body: { "url": string, "email": string | null }
Auth: None (public endpoint)
Rate limit: 5/hour per IP (Redis key: audit:quick:{sha256(ip)})
```

**What geo-seo-claude runs:**
```python
# GeoAuditService.run_quick_audit(url) must call:
# 1. fetch_page.py --mode quick → gets robots.txt, checks GPTBot/ClaudeBot/PerplexityBot
# 2. citability_scorer.py → overall citability score
# 3. Infer has_llms_txt, schema_org presence from page HTML
```

**Response contract (QuickAuditResult):**
```json
{
  "overall_geo_score": 67.4,
  "citability_score": 71.0,
  "ai_crawler_access": {
    "GPTBot": true,
    "ClaudeBot": false,
    "PerplexityBot": true,
    "GoogleExtended": true
  },
  "has_llms_txt": false,
  "schema_org": { "types": ["WebSite", "Organization"] },
  "top_issues": [
    "ClaudeBot is blocked in robots.txt",
    "No llms.txt file detected",
    "Citability score below threshold (71 < 75)"
  ],
  "top_recommendations": [
    "Add 'Allow: ClaudeBot' to robots.txt",
    "Create llms.txt at domain root",
    "Add FAQ structured data to homepage"
  ],
  "audit_id": "uuid"
}
```

**Frontend behavior:**
- On success → show `AuditPreviewCard`:
  - Big circular gauge: `overall_geo_score` (animated, counts up)
  - 4 badge row: GPTBot ✓/✗, ClaudeBot ✓/✗, PerplexityBot ✓/✗, llms.txt ✓/✗
  - Blurred list of `top_issues` (first item visible, rest blurred)
  - CTA: "See full report — Create free account" → `/auth/sign-up?from=audit&url={url}&audit_id={id}`
- On 429 → show rate limit message: "Too many audits — try again in an hour"
- On error → inline error in the input card, not a page redirect

**Check:** Does `POST /api/v1/audit/quick` exist and return this exact shape? If not, implement it.

---

### 1.2 Lead capture after audit preview
**UI element:** Email field that appears below the preview card: "Get the full report in your inbox"

**Backend contract:**
```
PATCH /api/v1/audit/quick/{audit_id}/email
Body: { "email": string }
Auth: None
```
Updates `PublicAudit.email` for the given audit_id.

**Check:** Does this endpoint exist? If not, add it to `audit.py` router.

---

## SCREEN 2 — ONBOARDING (post-signup)

### 2.1 Step 1 — Add brand
**UI element:** Domain input + brand name + industry dropdown.

**Backend contract:**
```
POST /api/v1/projects
Body: {
  "domain": "example.com",
  "name": "My Brand",
  "industry": "SaaS",
  "competitors": []  // empty on step 1, filled in step 2
}
Auth: Clerk JWT required
```
Returns `{ project_id, domain, name }`.

**Check:** Does `POST /api/v1/projects` exist? Validate it creates a project scoped to the user's tenant.

---

### 2.2 Step 2 — Add competitors
**UI element:** Up to 5 competitor URLs with add/remove.

**Backend contract:**
```
PATCH /api/v1/projects/{id}/competitors
Body: { "competitors": ["competitor1.com", "competitor2.com"] }
Auth: Clerk JWT required
```

**Check:** Does this endpoint exist? If not, add it.

---

### 2.3 Step 3 — First analysis (progress screen)
**UI element:** 4 animated steps: "Querying ChatGPT... ✓ · Perplexity... · Gemini... · Google AI..."

**Backend contract:**
```
POST /api/v1/projects/{id}/runs
Body: { "trigger": "onboarding" }
Auth: Clerk JWT required
```
Kicks off `FullPipelineWorkflow` via Temporal. Returns `{ run_id, status: "started" }`.

**Status polling:**
```
GET /api/v1/projects/{id}/runs/{run_id}/status
Returns: {
  "run_id": "...",
  "status": "running" | "completed" | "failed",
  "stages": {
    "chatgpt": "completed",
    "perplexity": "running",
    "gemini": "pending",
    "google_ai": "pending"
  },
  "progress_pct": 45
}
```
Frontend polls this every 3 seconds. Each stage completion triggers the ✓ animation.

**Check:** Does the run status endpoint expose per-engine stage breakdown? If not, add `stages` to the status response from `EngineRun` records in DB.

---

## SCREEN 3 — DASHBOARD / VISIBILITY PAGE

### 3.1 AI Assistant Widget (top of page, most critical)
**UI element:** Pulsing icon + streaming text summary: "Your Perplexity SoV grew +8.4%..."

**Backend contract:**
```
GET /api/v1/projects/{id}/assistant/summary
Auth: Clerk JWT required
Query: ?run_id={latest} (optional, defaults to most recent completed run)
```

**What this endpoint does:**
1. Fetches the latest `VisibilityScore` rows for this project (all engines)
2. Fetches previous period's scores for delta calculation
3. Calls OpenAI `gpt-4o` with a system prompt that includes:
   - Current scores, deltas, competitor gaps, top issues from geo-seo-claude
   - Instruction: "Write a 3-sentence analyst summary. Be specific with numbers. End with the single most impactful action."
4. **Streams the response** via SSE (Server-Sent Events)

**SSE response format:**
```
data: {"chunk": "Your Perplexity Share of Voice"}
data: {"chunk": " grew +8.4% this week"}
data: {"chunk": ", reaching your best rank ever at #2.1."}
data: {"done": true, "full_text": "...complete summary..."}
```

**Frontend:** Uses `EventSource` to consume the stream. Renders each chunk as it arrives (typewriter effect built-in via SSE).

**Implementation note:** Use `fastapi.responses.StreamingResponse` with `media_type="text/event-stream"`.

**Check:** Implement `GET /api/v1/projects/{id}/assistant/summary` as a streaming SSE endpoint if it doesn't exist.

---

### 3.2 Metric Cards (4 cards: Score / SoV / Avg Rank / Citation Rate)
**UI element:** Big numbers with delta badges and sparklines.

**Backend contract:**
```
GET /api/v1/projects/{id}/dashboard
Auth: Clerk JWT required
Query: ?period=7d|30d|90d (default: 7d)
```

**Response:**
```json
{
  "period": "7d",
  "overall_score": 67.4,
  "overall_score_delta": +4.2,
  "share_of_voice": 23.7,
  "share_of_voice_delta": +2.1,
  "avg_rank": 2.8,
  "avg_rank_delta": -0.3,
  "citation_rate": 41.2,
  "citation_rate_delta": +1.8,
  "sparklines": {
    "score": [60, 62, 63, 65, 66, 67, 67.4],
    "sov": [21, 21.5, 22, 22.8, 23.1, 23.5, 23.7]
  }
}
```

**Data source:** Aggregate `VisibilityScore` rows for this project, grouped by date bucket. Delta = current period vs previous period.

**Check:** Does `GET /api/v1/dashboard/{project_id}` (or equivalent) return these exact fields? If not, update the dashboard router to include `sparklines` and `overall_score`.

---

### 3.3 Share of Voice Donut Chart
**UI element:** Pie chart — client vs competitors by SoV%.

**Backend contract:**
```
GET /api/v1/projects/{id}/sov
Auth: Clerk JWT required
Query: ?period=7d|30d|90d
```

**Response:**
```json
{
  "brands": [
    { "domain": "myclient.com", "sov_pct": 23.7, "is_client": true },
    { "domain": "adidas.com",   "sov_pct": 19.4, "is_client": false },
    { "domain": "puma.com",     "sov_pct": 11.8, "is_client": false }
  ],
  "total_tracked_brands": 10
}
```

**Data source:** Aggregate `Mention` table — count mentions per domain across all answers in the run period, calculate percentage of total.

**Check:** Does this endpoint exist returning `is_client` flag? If not, implement it. The `is_client` flag comes from matching `domain` against `project.domain`.

---

### 3.4 Platform Ranking Table (ChatGPT / Perplexity / Google AI / Gemini)
**UI element:** Table with SoV%, Visibility%, Avg Rank columns per platform.

**Backend contract:** (already in existing dashboard router, verify shape)
```
GET /api/v1/projects/{id}/dashboard/platforms
Auth: Clerk JWT required
```

**Response:**
```json
{
  "platforms": [
    {
      "engine": "ChatGPT",
      "sov_pct": 44.0,
      "visibility_pct": 35.1,
      "avg_rank": 2.1,
      "run_count": 12
    },
    { "engine": "Perplexity", ... },
    { "engine": "Google AI",  ... },
    { "engine": "Gemini",     ... }
  ]
}
```

**Data source:** Join `EngineRun` → `VisibilityScore`, group by `engine`, average `sov`, `avg_rank`, `citation_rate`.

**Check:** Verify this endpoint returns all 4 platforms. If Gemini/Google AI are missing because the engine connector wasn't wired, add `gemini` and `google_ai` as engine types in `engine_connector.py`.

---

### 3.5 Trends Chart (dual line: SoV + Visibility, weekly)
**UI element:** AreaChart with 12 data points, x-axis = weeks.

**Backend contract:**
```
GET /api/v1/projects/{id}/trends
Auth: Clerk JWT required
Query: ?weeks=12&metric=sov,visibility
```

**Response:**
```json
{
  "labels": ["Jan 26", "Feb 2", "Feb 9", ...],
  "series": {
    "sov":        [21.0, 21.5, 22.0, 22.8, 23.1, 23.5, 23.7, ...],
    "visibility": [30.0, 31.2, 32.0, 33.1, 33.8, 34.5, 35.1, ...]
  }
}
```

**Data source:** `VisibilityScore` rows ordered by `computed_at`, grouped into ISO week buckets, averaged per week.

**Check:** Does a trends endpoint exist returning this shape? If not, create it.

---

### 3.6 Visibility Breakdown (horizontal bars: all brands)
**UI element:** List of all brands with colored bars proportional to SoV.

**Backend contract:** Same as `GET /api/v1/projects/{id}/sov` — reuse the `brands` array. Frontend renders it as horizontal bars. No separate endpoint needed.

---

### 3.7 Run Status Bar (sticky bottom)
**UI element:** "Last updated: X hours ago" + engine status + "Run now" button.

**Backend contracts:**
```
GET /api/v1/projects/{id}/runs/latest
Returns: { run_id, status, completed_at, stages: {...} }

POST /api/v1/projects/{id}/runs
Body: { "trigger": "manual" }
Returns: { run_id, status: "started" }
```

**Check:** `GET /api/v1/projects/{id}/runs/latest` — does it exist? If not, add it. It should return the most recent `EngineRun` with its per-engine stage status.

---

## SCREEN 4 — CITATIONS PAGE

### 4.1 Citation Explorer Table
**UI element:** Table — Source Domain / Platform / Query Context / Times Cited / Trend / First Seen.

**Backend contract:**
```
GET /api/v1/projects/{id}/citations
Auth: Clerk JWT required
Query: ?engine=all|chatgpt|perplexity|google_ai|gemini
       &domain=filter_string (optional)
       &page=1&limit=50
```

**Response:**
```json
{
  "total": 234,
  "citations": [
    {
      "domain": "techcrunch.com",
      "engine": "Perplexity",
      "times_cited": 14,
      "is_client_domain": false,
      "first_seen": "2026-01-15",
      "query_preview": "best SaaS analytics tools for startups",
      "trend": [2, 3, 3, 4, 2, 0, 14],
      "citation_ids": ["uuid1", "uuid2"]
    }
  ]
}
```

**Row expansion:**
```
GET /api/v1/projects/{id}/citations/{domain}/detail
Returns: {
  "domain": "techcrunch.com",
  "all_queries": [
    {
      "query": "best SaaS analytics tools for startups",
      "engine": "Perplexity",
      "ai_response_excerpt": "According to TechCrunch, the leading tools include...",
      "cited_at": "2026-04-10"
    }
  ]
}
```

**Data source:** `Citation` table joined to `Answer` for query text, joined to `EngineRun` for engine type.

**Check:** Implement both endpoints if missing.

---

## SCREEN 5 — COMPETITORS PAGE

### 5.1 Race Chart + Platform Matrix
**UI element:** Horizontal bars per brand + matrix table of brand vs platform.

**Backend contract:**
```
GET /api/v1/projects/{id}/competitors/comparison
Auth: Clerk JWT required
Query: ?period=7d|30d|90d
```

**Response:**
```json
{
  "brands": [
    {
      "domain": "myclient.com",
      "is_client": true,
      "overall_sov": 23.7,
      "by_platform": {
        "chatgpt":    { "sov": 44.0, "rank": 2.1 },
        "perplexity": { "sov": 45.6, "rank": 2.6 },
        "google_ai":  { "sov": 47.2, "rank": 3.1 },
        "gemini":     { "sov": 48.8, "rank": 3.6 }
      },
      "trend": [20, 21, 22, 23, 23.7]
    },
    { "domain": "competitor1.com", ... }
  ]
}
```

**Check:** Does this endpoint exist returning the `by_platform` breakdown? If not, implement it by joining `Mention` counts per brand per engine.

---

### 5.2 AI Insights Panel
**UI element:** Card: "You lead on Perplexity but trail Adidas on Gemini by 14 points..."

**Backend contract:**
```
GET /api/v1/projects/{id}/competitors/insights
Auth: Clerk JWT required
```
Calls OpenAI `gpt-4o` with the comparison data, returns a 2–3 sentence insight. **Cache result for 1 hour in Redis** (key: `insights:{project_id}:{date}`). Non-streaming (just JSON).

**Response:** `{ "insight": "You lead on Perplexity at rank #2.1..." }`

**Check:** Implement if missing.

---

## SCREEN 6 — PLATFORMS PAGE

### 6.1 Per-Platform Query Explorer
**UI element:** Tab per platform → list of all queries with rank + click to expand AI response.

**Backend contract:**
```
GET /api/v1/projects/{id}/platforms/{engine}/queries
Auth: Clerk JWT required
Query: ?sort=rank|date|citation_rate&order=asc|desc&page=1
Engine: chatgpt | perplexity | google_ai | gemini
```

**Response:**
```json
{
  "engine": "perplexity",
  "queries": [
    {
      "query_text": "best GEO optimization tools 2026",
      "rank": 1,
      "brand_mentioned": true,
      "mention_position": 2,
      "citation_count": 3,
      "answer_id": "uuid"
    }
  ]
}
```

**Query expansion — AI response with highlights:**
```
GET /api/v1/projects/{id}/answers/{answer_id}
Returns: {
  "answer_id": "uuid",
  "engine": "perplexity",
  "query_text": "...",
  "raw_text": "According to recent data, the top GEO tools include...",
  "brand_mentions": [
    { "brand": "myclient.com", "start": 45, "end": 58 }
  ]
}
```
Frontend highlights `brand_mentions` spans in cyan inside the raw text.

**Check:** Implement the query explorer endpoint and answer detail endpoint.

---

## SCREEN 7 — AI ASSISTANT PAGE

### 7.1 Full AI Report (streaming)
**UI element:** Long-form AI-written analysis, streams in on page load.

**Backend contract:**
```
GET /api/v1/projects/{id}/assistant/report
Auth: Clerk JWT required
Query: ?period=7d|30d|90d
```
SSE stream — same format as the widget summary but longer (4–6 sentences, covering: trend, best/worst platform, competitor gap, top risk, top opportunity).

**What the LLM receives as context:**
```python
system_prompt = """You are AVOP Intelligence, an AI analyst specializing in GEO (Generative Engine Optimization).
Analyze the provided visibility data and write a professional analyst report.
Be specific with numbers. Mention platforms by name. End with a clear top priority action.
Write 4-5 sentences. Tone: confident, data-driven, actionable."""

user_message = f"""
Brand: {project.domain}
Period: {period}

Current metrics:
- Overall GEO Score: {score} (delta: {delta:+.1f})
- Share of Voice: {sov}% (delta: {sov_delta:+.1f}%)
- Avg Rank: {avg_rank} (delta: {rank_delta:+.2f})

Platform breakdown:
{json.dumps(platform_data)}

Top competitors:
{json.dumps(competitor_data)}

Top issues from geo-seo-claude audit:
{json.dumps(top_issues)}
"""
```

**Check:** Implement if missing. Must be streaming SSE, not a regular JSON endpoint.

---

### 7.2 Prioritized Actions List
**UI element:** Action items with priority rank, impact estimate, Internal/External badge, mark-done.

**Backend contract:**
```
GET /api/v1/projects/{id}/recommendations
Auth: Clerk JWT required
```

**Response:**
```json
{
  "recommendations": [
    {
      "id": "uuid",
      "rank": 1,
      "title": "Add FAQ section to your homepage",
      "description": "FAQ schema markup increases AI citation rate by 15–20% on average.",
      "impact_estimate": "+5–8% SoV on ChatGPT",
      "category": "internal",
      "status": "pending",
      "source": "geo-seo-claude:geo-schema",
      "instructions": "Add a FAQPage JSON-LD block to <head>. Template: ..."
    }
  ]
}
```

**Data source:** `RecommendationService` (already exists in prototype). Make sure it populates `category` ("internal" | "external") and `impact_estimate`. Instructions field should reference the relevant `schema/*.json` template from geo-seo-claude.

**Mark done:**
```
PATCH /api/v1/projects/{id}/recommendations/{rec_id}
Body: { "status": "done" }
```

**Check:** Does the existing `RecommendationService` return the `category` and `instructions` fields? If not, update it.

---

### 7.3 Chat with AVOP AI
**UI element:** Chat input at bottom of Assistant page.

**Backend contract:**
```
POST /api/v1/projects/{id}/assistant/chat
Auth: Clerk JWT required
Body: {
  "message": "Why did my Gemini rank drop?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
SSE stream. The LLM receives project context + conversation history. Stateless on the backend — history is sent by the client each time.

**Check:** Implement if missing.

---

## SCREEN 8 — REPORTS PAGE

### 8.1 Generate PDF Report
**UI element:** "Download PDF" button per report.

**Backend contract:**
```
POST /api/v1/projects/{id}/reports
Body: {
  "period": "7d",
  "include_competitors": true,
  "platforms": ["chatgpt", "perplexity", "google_ai", "gemini"]
}
Auth: Clerk JWT required
Returns: { "report_id": "uuid", "status": "generating" }

GET /api/v1/projects/{id}/reports/{report_id}/download
Returns: PDF file (Content-Type: application/pdf)
```

**What generates the PDF:**
Use `scripts/generate_pdf_report.py` from geo-seo-claude. Pass it:
- GEO Score + all sub-scores
- Platform breakdown table
- Top 10 citations
- Competitor comparison
- Prioritized recommendations list

**Check:** Does `ReportGeneratorService` call `generate_pdf_report.py`? If it generates its own PDF separately, replace it with the geo-seo-claude script for consistency.

---

### 8.2 List of past reports
```
GET /api/v1/projects/{id}/reports
Returns: [{ report_id, created_at, period, download_url }]
```

---

## SCREEN 9 — SETTINGS PAGE

### 9.1 Project settings (domain, industry, competitors)
```
GET  /api/v1/projects/{id}
PATCH /api/v1/projects/{id}
Body: { "name", "industry", "domain", "competitors" }
```

### 9.2 Tracking schedule
```
PATCH /api/v1/projects/{id}/schedule
Body: { "frequency": "daily" | "weekly" }
```
Updates `ScheduledRunWorkflow` cron interval in Temporal.

### 9.3 API Key management
```
GET    /api/v1/projects/{id}/api-keys
POST   /api/v1/projects/{id}/api-keys       → generates new key
DELETE /api/v1/projects/{id}/api-keys/{key_id}
```

### 9.4 Billing (stub for now)
```
GET /api/v1/billing/plan
Returns: { plan: "free" | "growth" | "agency", usage: {...} }
```
For now returns hardcoded plan data. Wire to Stripe later.

---

## IMPLEMENTATION PRIORITIES

Execute in this order:

### Phase 1 — Must have before first demo (TODAY)
1. `POST /api/v1/audit/quick` — working with real geo-seo-claude call
2. `GET /api/v1/projects/{id}/dashboard` — real DB data, all 4 metrics + sparklines
3. `GET /api/v1/projects/{id}/dashboard/platforms` — all 4 platforms
4. `GET /api/v1/projects/{id}/assistant/summary` — SSE streaming, real GPT-4o call
5. `GET /api/v1/projects/{id}/runs/latest` — run status with per-engine stages
6. `POST /api/v1/projects/{id}/runs` — triggers real Temporal workflow

### Phase 2 — Full dashboard (this week)
7. `GET /api/v1/projects/{id}/sov` — donut chart data
8. `GET /api/v1/projects/{id}/trends` — 12-week time series
9. `GET /api/v1/projects/{id}/citations` — table + domain detail
10. `GET /api/v1/projects/{id}/competitors/comparison` — race chart data
11. `GET /api/v1/projects/{id}/recommendations` — with category + instructions
12. `PATCH /api/v1/projects/{id}/recommendations/{id}` — mark done

### Phase 3 — AI intelligence layer (next week)
13. `GET /api/v1/projects/{id}/assistant/report` — long streaming report
14. `POST /api/v1/projects/{id}/assistant/chat` — conversational AI
15. `GET /api/v1/projects/{id}/competitors/insights` — AI-generated insight
16. `GET /api/v1/projects/{id}/platforms/{engine}/queries` — per-platform queries
17. `GET /api/v1/projects/{id}/answers/{answer_id}` — response with highlights
18. PDF report generation via geo-seo-claude script

---

## FRONTEND ↔ BACKEND CONTRACT RULES

1. **Every chart component** must accept a `isLoading` prop and show skeleton when data is fetching
2. **All API calls** go through the generated TanStack Query hooks — no raw `fetch` in components
3. **SSE streams** use `EventSource` inside a custom `useStream(url)` hook that populates a `useState` string character by character
4. **Error states** are handled at the component level — never redirect on API error, show inline error card
5. **Project ID** always comes from the URL param `?p=` stored in TanStack Router, not from React state
6. **Period selector** (7d / 30d / 90d) is a global filter in the top bar — stored in URL as `?period=7d`, passed to all dashboard queries as a query param
7. **Optimistic updates** on "Mark done" for recommendations — update UI immediately, revert on error
8. **All API responses** include `updated_at` timestamp — show "Last updated X ago" in the Run Status Bar

---

## GEO-SEO-CLAUDE WIRING CHECKLIST

Verify these specific integrations are working:

- [ ] `citability_scorer.py` is called during `RunEngineWorkflow` and its output stored in `VisibilityScore.citability_score`
- [ ] `fetch_page.py --mode full` is called and its robots.txt parse stored in `Answer` metadata
- [ ] `brand_scanner.py` output is stored in `Mention` table with `source_platform` field
- [ ] `llmstxt_generator.py` is called during quick audit and result stored in `QuickAuditResult.llmstxt_preview`
- [ ] `generate_pdf_report.py` is called (not a custom PDF generator) when creating reports
- [ ] Schema templates from `schema/*.json` are referenced in recommendation `instructions` field
- [ ] Scoring weights (25/20/20/15/10/10) are preserved when computing `VisibilityScore.overall_score`
- [ ] `agents/geo-platform-analysis.md` instructions are used as system prompt for platform-specific queries in `RunEngineWorkflow`
