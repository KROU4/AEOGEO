import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";

export interface AnalyticsIntegration {
  id: string;
  project_id: string;
  provider: "google_analytics" | "yandex_metrica";
  external_id: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface AnalyticsIntegrationCreate {
  provider: "google_analytics" | "yandex_metrica";
  external_id: string;
  credentials: string;
}

export interface AnalyticsIntegrationUpdate {
  external_id?: string;
  credentials?: string;
  is_active?: boolean;
}

export interface TrafficDataPoint {
  date: string;
  pageviews: number;
  sessions: number;
  users: number;
  traffic_sources: Record<string, number>;
}

export interface TrafficSummary {
  provider: string | null;
  period_start: string;
  period_end: string;
  total_pageviews: number;
  total_sessions: number;
  total_users: number;
  daily: TrafficDataPoint[];
  traffic_sources: Record<string, number>;
}

export interface TrafficSyncResult {
  synced: Record<string, number>;
}

// --- Integration CRUD ---

export function useAnalyticsIntegrations(projectId?: string) {
  return useQuery({
    queryKey: ["analytics-integrations", projectId],
    queryFn: () =>
      apiGet<AnalyticsIntegration[]>(
        `/projects/${projectId}/analytics/integrations`,
      ),
    enabled: !!projectId,
  });
}

export function useCreateAnalyticsIntegration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AnalyticsIntegrationCreate) =>
      apiPost<AnalyticsIntegration>(
        `/projects/${projectId}/analytics/integrations`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analytics-integrations", projectId],
      });
    },
  });
}

export function useUpdateAnalyticsIntegration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationId,
      data,
    }: {
      integrationId: string;
      data: AnalyticsIntegrationUpdate;
    }) =>
      apiPut<AnalyticsIntegration>(
        `/projects/${projectId}/analytics/integrations/${integrationId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analytics-integrations", projectId],
      });
    },
  });
}

export function useDeleteAnalyticsIntegration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) =>
      apiDelete(
        `/projects/${projectId}/analytics/integrations/${integrationId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["analytics-integrations", projectId],
      });
    },
  });
}

export function useTestAnalyticsConnection(projectId: string) {
  return useMutation({
    mutationFn: (integrationId: string) =>
      apiPost<{ success: boolean }>(
        `/projects/${projectId}/analytics/integrations/${integrationId}/test`,
      ),
  });
}

// --- Traffic data ---

export function useTrafficData(
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();

  return useQuery({
    queryKey: ["traffic", projectId, startDate, endDate],
    queryFn: () =>
      apiGet<TrafficSummary>(
        `/projects/${projectId}/analytics/traffic${qs ? `?${qs}` : ""}`,
      ),
    enabled: !!projectId,
  });
}

export function useSyncTraffic(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<TrafficSyncResult>(
        `/projects/${projectId}/analytics/sync`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["traffic", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["analytics-integrations", projectId],
      });
    },
  });
}
