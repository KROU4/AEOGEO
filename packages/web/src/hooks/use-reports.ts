import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiDelete, apiGet, apiGetPublic, apiPost } from "@/lib/api-client";
import type {
  PublicReport,
  Report,
  ReportSummary,
  ShareLink,
} from "@/types/report";
import type { PaginatedResponse } from "@/types/api";

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => apiGet<PaginatedResponse<ReportSummary>>("/reports/"),
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ["reports", id],
    queryFn: () => apiGet<Report>(`/reports/${id}`),
    enabled: !!id,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { projectId: string; reportType: string }) =>
      apiPost<ReportSummary>(`/projects/${data.projectId}/reports/generate`, {
        report_type: data.reportType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useReportShareLink(id: string, enabled = true) {
  return useQuery({
    queryKey: ["reports", id, "share"],
    queryFn: async () => {
      try {
        return await apiGet<ShareLink>(`/reports/${id}/share`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!id && enabled,
  });
}

export function useShareReport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<ShareLink>(`/reports/${id}/share`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports", id] });
      queryClient.invalidateQueries({ queryKey: ["reports", id, "share"] });
    },
  });
}

export function usePublicReport(shareToken: string) {
  return useQuery({
    queryKey: ["public-report", shareToken],
    queryFn: () => apiGetPublic<PublicReport>(`/public/reports/${shareToken}`),
    enabled: !!shareToken,
    retry: false,
  });
}
