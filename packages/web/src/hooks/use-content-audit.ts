import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";

export interface ContentAuditEvent {
  id: string;
  project_id: string;
  content_title: string | null;
  content_url: string | null;
  published_at: string;
  recheck_at: string;
  status: string;
  baseline_total_score: number;
  baseline_mentions: number;
  baseline_citations: number;
  checked_total_score: number | null;
  checked_mentions: number | null;
  checked_citations: number | null;
  delta_total_score: number | null;
  delta_mentions: number | null;
  delta_citations: number | null;
}

export interface ContentAuditSummary {
  project_id: string;
  total_events: number;
  completed_events: number;
  avg_delta_total_score: number;
  total_delta_mentions: number;
  total_delta_citations: number;
}

export interface ContentAuditTriggerPayload {
  content_title?: string;
  content_url?: string;
  published_at?: string;
  mode?: "manual" | "scheduled";
  delay_hours?: number;
}

export function useContentAuditEvents(projectId: string | undefined) {
  return useQuery({
    queryKey: ["content-audit-events", projectId],
    enabled: !!projectId,
    queryFn: () =>
      apiGet<ContentAuditEvent[]>(
        `/projects/${projectId}/content-audit/attribution?limit=20`,
      ),
  });
}

export function useContentAuditSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: ["content-audit-summary", projectId],
    enabled: !!projectId,
    queryFn: () =>
      apiGet<ContentAuditSummary>(
        `/projects/${projectId}/content-audit/attribution/summary`,
      ),
  });
}

export function useTriggerContentAudit(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContentAuditTriggerPayload) =>
      apiPost<ContentAuditEvent>(`/projects/${projectId}/content-audit/trigger`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-audit-events", projectId] });
      queryClient.invalidateQueries({ queryKey: ["content-audit-summary", projectId] });
    },
  });
}
