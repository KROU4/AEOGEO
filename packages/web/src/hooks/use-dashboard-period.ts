import { useSearch } from "@tanstack/react-router";
import type { DashboardPeriod } from "@/lib/dashboard-search";

/** Global dashboard period from URL (`/_dashboard?period=`). Defaults to `30d`. */
export function useDashboardPeriod(): DashboardPeriod {
  const { period } = useSearch({ strict: false }) as {
    period?: DashboardPeriod;
  };
  return period ?? "30d";
}
