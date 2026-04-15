import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { DashboardPeriod } from "@/lib/dashboard-search";
import type { ProjectDashboardResponse } from "@/types/project-dashboard";

export function useProjectDashboard(
  projectId: string | undefined,
  period: DashboardPeriod,
) {
  return useQuery({
    queryKey: ["project-dashboard", projectId, period],
    queryFn: () =>
      apiGet<ProjectDashboardResponse>(
        `/projects/${projectId}/dashboard?period=${encodeURIComponent(period)}`,
      ),
    enabled: !!projectId,
  });
}
