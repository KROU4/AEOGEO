import { useEffect, useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import {
  readStoredAnalyticsProjectId,
  resolveAnalyticsProjectId,
  writeStoredAnalyticsProjectId,
} from "@/lib/overview-project";

/** Shared project scope for explorer / Stitch analytics pages (localStorage + resolver). */
export function useExplorerProjectId() {
  const [preferredProjectId, setPreferredProjectId] = useState<string | null>(
    () => readStoredAnalyticsProjectId(),
  );
  const { data: projectsData, isLoading } = useProjects();
  const projects = projectsData?.items ?? [];
  const projectId = resolveAnalyticsProjectId(projects, preferredProjectId);

  useEffect(() => {
    if (projectId) {
      writeStoredAnalyticsProjectId(projectId);
    }
  }, [projectId]);

  return {
    projectId,
    projects,
    isLoadingProjects: isLoading,
    preferredProjectId,
    setPreferredProjectId,
  };
}
