# GEO-SEO-CLAUDE integration checklist (audit)

Cross-reference for `cursor-integration-plan.md` GEO checklist. Status is based on repository search; update this file when wiring changes.

| Item | Status | Notes |
|------|--------|--------|
| `citability_scorer.py` in `RunEngineWorkflow` → `VisibilityScore.citability_score` | Not found | No `citability` symbol under `packages/api`; scoring uses six dimensions in [`app/services/scoring.py`](../packages/api/app/services/scoring.py) (`mention`, `sentiment`, `position`, `accuracy`, `citation`, `recommendation`). |
| `fetch_page.py --mode full` + robots.txt on `Answer` metadata | Not found | No `fetch_page` reference in API package; ingestion uses separate document/crawl paths. |
| `brand_scanner.py` → `Mention.source_platform` | Partial / verify | [`Mention`](../packages/api/app/models/mention.py) model should be checked for `source_platform`; brand scanner name not present in `.py` grep. |
| `llmstxt_generator.py` in quick audit → `QuickAuditResult.llmstxt_preview` | Not verified here | Audit router: [`app/routers/audit.py`](../packages/api/app/routers/audit.py). |
| `generate_pdf_report.py` (geo-seo-claude script) for reports | Replaced | PDF built in-app: [`app/services/generate_pdf_report.py`](../packages/api/app/services/generate_pdf_report.py); download: `GET /projects/{project_id}/reports/{report_id}/download`. |
| Schema templates in recommendation `instructions` | Verify per tenant | Recommendations API exists; template linkage is data/content concern. |
| Scoring weights 25/20/20/15/10/10 | Different | [`DEFAULT_WEIGHTS`](../packages/api/app/services/scoring.py) are equal **1/6** per dimension unless overridden elsewhere. |
| `agents/geo-platform-analysis.md` as system prompt in `RunEngineWorkflow` | Not found | Grep did not match `geo-platform-analysis`; engine workflows under [`app/workflows/`](../packages/api/app/workflows/). |

**Suggested next steps:** (1) Decide whether to align `DEFAULT_WEIGHTS` with product spec or document the equal-weight policy. (2) If geo-seo-claude scripts must run verbatim, add thin adapters in activities that call packaged CLI entrypoints and map outputs into existing models.
