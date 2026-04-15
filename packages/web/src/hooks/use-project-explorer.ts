import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet } from "@/lib/api-client";
import type {
  CitationDomainDetailResponse,
  CitationsListResponse,
  CompetitorsComparisonResponse,
  CompetitorsInsightResponse,
  PlatformQueriesResponse,
} from "@/types/project-explorer";
import type { DashboardPeriod } from "@/lib/dashboard-search";

export function useProjectCitations(
  projectId: string | undefined,
  options?: {
    engine?: string;
    domain?: string;
    page?: number;
    limit?: number;
  },
) {
  const engine = options?.engine ?? "all";
  const domain = options?.domain?.trim() || undefined;
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  return useQuery({
    queryKey: [
      "explorer",
      "citations",
      projectId,
      engine,
      domain ?? "",
      page,
      limit,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        engine,
        page: String(page),
        limit: String(limit),
      });
      if (domain) {
        params.set("domain", domain);
      }
      return apiGet<CitationsListResponse>(
        `/projects/${projectId}/citations?${params}`,
      );
    },
    enabled: !!projectId,
  });
}

export function useCitationDomainDetail(
  projectId: string | undefined,
  domain: string | null,
  options?: { enabled?: boolean },
) {
  const enabled = (options?.enabled ?? true) && !!projectId && !!domain;
  return useQuery({
    queryKey: ["explorer", "citations", "detail", projectId, domain],
    queryFn: () =>
      apiGet<CitationDomainDetailResponse>(
        `/projects/${projectId}/citations/${encodeURIComponent(domain!)}/detail`,
      ),
    enabled,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useCompetitorsComparison(
  projectId: string | undefined,
  period: DashboardPeriod,
) {
  return useQuery({
    queryKey: ["explorer", "competitors", "comparison", projectId, period],
    queryFn: () =>
      apiGet<CompetitorsComparisonResponse>(
        `/projects/${projectId}/competitors/comparison?period=${period}`,
      ),
    enabled: !!projectId,
  });
}

export function useCompetitorsInsight(
  projectId: string | undefined,
  period: DashboardPeriod,
) {
  return useQuery({
    queryKey: ["explorer", "competitors", "insights", projectId, period],
    queryFn: () =>
      apiGet<CompetitorsInsightResponse>(
        `/projects/${projectId}/competitors/insights?period=${period}`,
      ),
    enabled: !!projectId,
  });
}

export function usePlatformQueries(
  projectId: string | undefined,
  engineSlug: string,
  options?: {
    sort?: "rank" | "date" | "citation_rate";
    order?: "asc" | "desc";
    page?: number;
    limit?: number;
  },
) {
  const sort = options?.sort ?? "date";
  const order = options?.order ?? "desc";
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  return useQuery({
    queryKey: [
      "explorer",
      "platform-queries",
      projectId,
      engineSlug,
      sort,
      order,
      page,
      limit,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        sort,
        order,
        page: String(page),
        limit: String(limit),
      });
      return apiGet<PlatformQueriesResponse>(
        `/projects/${projectId}/platforms/${encodeURIComponent(engineSlug)}/queries?${params}`,
      );
    },
    enabled: !!projectId && !!engineSlug,
  });
}
