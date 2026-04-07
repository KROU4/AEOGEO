import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";

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
}

interface RecommendationGenerateRequest {
  run_id?: string | null;
}

interface RecommendationGenerateResponse {
  recommendations: Recommendation[];
  run_id: string;
  scores_analyzed: number;
}

export function useRecommendations(projectId: string) {
  return useQuery({
    queryKey: ["recommendations", projectId],
    queryFn: () =>
      apiGet<Recommendation[]>(`/projects/${projectId}/recommendations`),
    enabled: !!projectId,
  });
}

export function useGenerateRecommendations(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecommendationGenerateRequest = {}) =>
      apiPost<RecommendationGenerateResponse>(
        `/projects/${projectId}/recommendations/generate`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["recommendations", projectId],
      });
    },
  });
}
