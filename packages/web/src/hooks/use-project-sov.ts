import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { ProjectSovResponse } from "@/types/project-sov";

export function useProjectSov(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-sov", projectId],
    queryFn: () => apiGet<ProjectSovResponse>(`/projects/${projectId}/sov`),
    enabled: !!projectId,
  });
}
