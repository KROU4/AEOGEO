import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { DashboardPlatformsResponse } from "@/types/dashboard-platforms";

export function useProjectDashboardPlatforms(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-dashboard-platforms", projectId],
    queryFn: () =>
      apiGet<DashboardPlatformsResponse>(
        `/projects/${projectId}/dashboard/platforms`,
      ),
    enabled: !!projectId,
  });
}
