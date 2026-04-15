/** URL search state for `/_dashboard` — global period filter + optional project alias `p`. */

import { writeStoredAnalyticsProjectId } from "@/lib/overview-project";

export const DASHBOARD_PERIODS = ["7d", "30d", "90d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DashboardSearchState = {
  /** When omitted, UI defaults to `30d` (see `useDashboardPeriod`). */
  period?: DashboardPeriod;
  /** Optional project UUID — persisted to analytics storage then stripped from URL. */
  p?: string;
};

export function parseDashboardSearch(
  search: Record<string, unknown>,
): DashboardSearchState {
  const raw = search.period;
  const period: DashboardPeriod | undefined =
    raw === "7d" || raw === "30d" || raw === "90d" ? raw : undefined;
  const p =
    typeof search.p === "string" && UUID_RE.test(search.p) ? search.p : undefined;
  return { period, p };
}

export function persistProjectAliasFromSearch(p: string | undefined): void {
  if (!p) return;
  writeStoredAnalyticsProjectId(p);
}
