import type { Project } from "@/types/project";

export const ANALYTICS_PROJECT_STORAGE_KEY = "aeogeo_analytics_project_id";
export const OVERVIEW_PROJECT_STORAGE_KEY = ANALYTICS_PROJECT_STORAGE_KEY;

type ProjectLike = Pick<Project, "id" | "created_at">;

function getProjectTimestamp(project: ProjectLike): number {
  const timestamp = Date.parse(project.created_at);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function resolveAnalyticsProjectId(
  projects: ProjectLike[],
  preferredProjectId?: string | null,
): string | null {
  if (projects.length === 0) {
    return null;
  }

  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }

  return [...projects].sort(
    (left, right) => getProjectTimestamp(left) - getProjectTimestamp(right),
  )[0]?.id ?? null;
}

export function resolveOverviewProjectId(
  projects: ProjectLike[],
  preferredProjectId?: string | null,
): string | null {
  return resolveAnalyticsProjectId(projects, preferredProjectId);
}

export function readStoredAnalyticsProjectId(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): string | null {
  try {
    return storage.getItem(ANALYTICS_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readStoredOverviewProjectId(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): string | null {
  return readStoredAnalyticsProjectId(storage);
}

export function writeStoredAnalyticsProjectId(
  projectId: string,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  try {
    storage.setItem(ANALYTICS_PROJECT_STORAGE_KEY, projectId);
  } catch {
    // Ignore storage write failures.
  }
}

export function writeStoredOverviewProjectId(
  projectId: string,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  writeStoredAnalyticsProjectId(projectId, storage);
}

export function clearStoredAnalyticsProjectId(
  storage: Pick<Storage, "removeItem"> = window.localStorage,
): void {
  try {
    storage.removeItem(ANALYTICS_PROJECT_STORAGE_KEY);
  } catch {
    // Ignore storage write failures.
  }
}

export function clearStoredOverviewProjectId(
  storage: Pick<Storage, "removeItem"> = window.localStorage,
): void {
  clearStoredAnalyticsProjectId(storage);
}
