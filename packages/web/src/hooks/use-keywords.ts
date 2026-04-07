import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";

export interface Keyword {
  id: string;
  project_id: string;
  keyword: string;
  category: string;
  search_volume: number | null;
  relevance_score: number | null;
  is_selected: boolean;
  created_at: string;
  updated_at: string | null;
}

interface KeywordCreate {
  keyword: string;
  category?: string;
  relevance_score?: number | null;
  is_selected?: boolean;
}

interface KeywordUpdate {
  keyword?: string;
  category?: string;
  is_selected?: boolean;
}

interface KeywordGenerateRequest {
  max_keywords?: number;
  categories?: string[] | null;
}

interface KeywordGenerateResponse {
  keywords: Keyword[];
  knowledge_entries_considered: number;
}

export function useKeywords(projectId: string) {
  return useQuery({
    queryKey: ["keywords", projectId],
    queryFn: () => apiGet<Keyword[]>(`/projects/${projectId}/keywords`),
    enabled: !!projectId,
  });
}

export function useGenerateKeywords(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: KeywordGenerateRequest = {}) =>
      apiPost<KeywordGenerateResponse>(
        `/projects/${projectId}/keywords/generate`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords", projectId] });
    },
  });
}

export function useCreateKeyword(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: KeywordCreate) =>
      apiPost<Keyword>(`/projects/${projectId}/keywords`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords", projectId] });
    },
  });
}

export function useUpdateKeyword(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: KeywordUpdate & { id: string }) =>
      apiPut<Keyword>(`/projects/${projectId}/keywords/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords", projectId] });
    },
  });
}

export function useDeleteKeyword(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keywordId: string) =>
      apiDelete(`/projects/${projectId}/keywords/${keywordId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords", projectId] });
    },
  });
}
