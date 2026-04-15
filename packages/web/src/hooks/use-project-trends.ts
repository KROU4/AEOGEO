import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { ProjectTrendsResponse } from "@/types/project-trends";

export function useProjectTrends(
  projectId: string | undefined,
  weeks = 12,
) {
  return useQuery({
    queryKey: ["project-trends", projectId, weeks],
    queryFn: () =>
      apiGet<ProjectTrendsResponse>(
        `/projects/${projectId}/trends?weeks=${weeks}`,
      ),
    enabled: !!projectId,
  });
}
