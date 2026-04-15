import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

export interface Recommendation {
  id: string;
  project_id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  affected_keywords: string[] | null;
  run_id: string | null;
  created_at: string;
  updated_at: string | null;
  status?: string;
  rank?: number | null;
  impact_estimate?: string | null;
  instructions?: string | null;
  source?: string | null;
  visibility_scope?: string | null;
}

interface RecommendationGenerateRequest {
  run_id?: string | null;
}

interface RecommendationGenerateResponse {
  recommendations: Recommendation[];
  run_id: string;
  scores_analyzed: number;
}

export function useRecommendations(projectId: string | undefined) {
  return useQuery({
    queryKey: ["recommendations", projectId],
    queryFn: () =>
      apiGet<Recommendation[]>(`/projects/${projectId}/recommendations`),
    enabled: !!projectId,
  });
}

export function useGenerateRecommendations(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecommendationGenerateRequest = {}) => {
      if (!projectId) {
        return Promise.reject(new Error("Missing project"));
      }
      return apiPost<RecommendationGenerateResponse>(
        `/projects/${projectId}/recommendations/generate`,
        data,
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["recommendations", projectId],
        });
      }
    },
  });
}

export function usePatchRecommendationStatus(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: "pending" | "done" }) => {
      if (!projectId) {
        return Promise.reject(new Error("Missing project"));
      }
      return apiPatch<Recommendation>(
        `/projects/${projectId}/recommendations/${args.id}`,
        { status: args.status },
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["recommendations", projectId],
        });
      }
    },
  });
}
