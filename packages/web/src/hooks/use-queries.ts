import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  QuerySet,
  QuerySetCreate,
  Query,
  QueryCreate,
  QueryUpdate,
  QueryGenerateRequest,
  BatchQueryStatusUpdate,
} from "@/types/query";
import type { PaginatedResponse } from "@/types/api";

export type BatchUpdateQueriesResponse = {
  updated: number;
};

export type GenerateQueriesResponse = {
  generated: number;
  queries: Query[];
};

// -- Query Sets --

export function useQuerySets(projectId: string) {
  return useQuery({
    queryKey: ["querySets", projectId],
    queryFn: () =>
      apiGet<PaginatedResponse<QuerySet>>(
        `/projects/${projectId}/query-sets`
      ),
    enabled: !!projectId,
  });
}

export function useQuerySet(projectId: string, querySetId: string) {
  return useQuery({
    queryKey: ["querySets", projectId, querySetId],
    queryFn: () =>
      apiGet<QuerySet>(
        `/projects/${projectId}/query-sets/${querySetId}`
      ),
    enabled: !!projectId && !!querySetId,
  });
}

export function useCreateQuerySet(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QuerySetCreate) =>
      apiPost<QuerySet>(`/projects/${projectId}/query-sets`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["querySets", projectId] });
    },
  });
}

// -- Queries --

export function useQueries(
  projectId: string,
  querySetId: string,
  filters?: { status?: string; category?: string }
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);

  return useQuery({
    queryKey: ["queries", projectId, querySetId, filters],
    queryFn: () =>
      apiGet<PaginatedResponse<Query>>(
        `/projects/${projectId}/query-sets/${querySetId}/queries${params.toString() ? `?${params}` : ""}`
      ),
    enabled: !!projectId && !!querySetId,
  });
}

export function useCreateQuery(projectId: string, querySetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QueryCreate) =>
      apiPost<Query>(
        `/projects/${projectId}/query-sets/${querySetId}/queries`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["queries", projectId, querySetId],
      });
      queryClient.invalidateQueries({ queryKey: ["querySets", projectId] });
    },
  });
}

export function useUpdateQuery(projectId: string, querySetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      queryId,
      data,
    }: {
      queryId: string;
      data: QueryUpdate;
    }) =>
      apiPut<Query>(
        `/projects/${projectId}/query-sets/${querySetId}/queries/${queryId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["queries", projectId, querySetId],
      });
      queryClient.invalidateQueries({ queryKey: ["querySets", projectId] });
    },
  });
}

export function useDeleteQuery(projectId: string, querySetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queryId: string) =>
      apiDelete(
        `/projects/${projectId}/query-sets/${querySetId}/queries/${queryId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["queries", projectId, querySetId],
      });
      queryClient.invalidateQueries({ queryKey: ["querySets", projectId] });
    },
  });
}

// -- Batch Operations --

export function useBatchUpdateQueries(projectId: string, querySetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchQueryStatusUpdate) =>
      apiPost<BatchUpdateQueriesResponse>(
        `/projects/${projectId}/query-sets/${querySetId}/queries/batch-update`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["queries", projectId, querySetId],
      });
      queryClient.invalidateQueries({ queryKey: ["querySets", projectId] });
    },
  });
}

// -- Generate & Cluster --

export function useGenerateQueries(projectId: string, querySetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QueryGenerateRequest) =>
      apiPost<GenerateQueriesResponse>(
        `/projects/${projectId}/query-sets/${querySetId}/generate`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["queries", projectId, querySetId],
      });
      queryClient.invalidateQueries({ queryKey: ["querySets", projectId] });
    },
  });
}

export function useClusterQueries(projectId: string, querySetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<unknown>(
        `/projects/${projectId}/query-sets/${querySetId}/cluster`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["queries", projectId, querySetId],
      });
      queryClient.invalidateQueries({ queryKey: ["querySets", projectId] });
    },
  });
}
