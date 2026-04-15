# Screen ↔ route ↔ hook ↔ API matrix

Maps dashboard and Stitch-aligned screens to TanStack routes, data hooks, and FastAPI paths. Use `isLoading` on charts (plan rule); explorer pages below use skeletons from shared UI patterns.

| Stitch / product screen | Route | Key hooks | API prefix (`/api/v1`) |
|-------------------------|-------|-----------|-------------------------|
| Overview | `/overview` | `useVisibilityScore`, `useSentiment`, `useScoreTrends`, … | `/dashboard/*?project_id=`, `/projects/{id}/scores/*` |
| AI Visibility | `/visibility` | same family + `useTrafficData` | same |
| Citations explorer | `/citations` | `useProjectCitations` | `GET /projects/{id}/citations` |
| Competitors | `/competitors` | `useCompetitorsComparison`, `useCompetitorsInsight`, `useDashboardPeriod` | `GET …/competitors/comparison`, `GET …/competitors/insights` |
| Platform deep dive | `/platforms` | `usePlatformQueries`, `useEngines` | `GET …/platforms/{engine}/queries` |
| AI assistant | `/assistant` | `streamAssistantReport`, `streamAssistantChat` | `GET …/assistant/report`, `POST …/assistant/chat` |
| Reports list / detail | `/reports`, `/reports/$reportId` | `useReports`, `useReport`, `useDownloadReportPdf` | `GET /reports/*`, `GET …/reports/{id}/download` |
| Projects | `/projects`, `/projects/$projectId`, … | `useProject`, `useRuns`, … | `/projects/*` |
| Settings | `/settings` | various | `/projects`, billing stubs |

**URL contract**

- **Project id (plan `?p=`):** optional `?p=<uuid>` on any `/_dashboard` URL is written to analytics project storage and stripped (path-based `/projects/$projectId` remains canonical for deep links).
- **Period (`?period=`):** global filter `7d` \| `30d` \| `90d` (default **30d** if omitted), shown in the top bar; passed where APIs accept `period` (e.g. competitors insight, assistant report).

**Stitch assets:** static reference HTML/PNG under `design/stitch-avop/`; product routes above align with MANIFEST screens 03–08 (plus landing/onboarding outside this matrix).
