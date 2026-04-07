import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type {
  EngineRun,
  RunCreate,
  RunProgress,
  Answer,
} from "@/types/run";
import type { PaginatedResponse } from "@/types/api";

// -- Runs --

export function useRuns(projectId: string) {
  return useQuery({
    queryKey: ["runs", projectId],
    queryFn: () =>
      apiGet<PaginatedResponse<EngineRun>>(`/projects/${projectId}/runs`),
    enabled: !!projectId,
  });
}

export function useRun(projectId: string, runId: string) {
  return useQuery({
    queryKey: ["runs", projectId, runId],
    queryFn: () =>
      apiGet<EngineRun>(`/projects/${projectId}/runs/${runId}`),
    enabled: !!projectId && !!runId,
  });
}

export function useCreateRun(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RunCreate) =>
      apiPost<EngineRun>(`/projects/${projectId}/runs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs", projectId] });
    },
  });
}

export function useRetryRun(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      apiPost<EngineRun>(`/projects/${projectId}/runs/${runId}/retry`, {}),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ["runs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["runs", projectId, runId] });
      queryClient.invalidateQueries({
        queryKey: ["runs", projectId, runId, "progress"],
      });
      queryClient.invalidateQueries({
        queryKey: ["runs", projectId, runId, "answers"],
      });
    },
  });
}

export function useCancelRun(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      apiPost<EngineRun>(`/projects/${projectId}/runs/${runId}/cancel`, {}),
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: ["runs", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["runs", projectId, runId, "progress"],
      });
    },
  });
}

// -- Progress (polls while running) --

export function useRunProgress(projectId: string, runId: string) {
  return useQuery({
    queryKey: ["runs", projectId, runId, "progress"],
    queryFn: () =>
      apiGet<RunProgress>(
        `/projects/${projectId}/runs/${runId}/progress`
      ),
    enabled: !!projectId && !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "pending") {
        return 2000;
      }
      return false;
    },
  });
}

// -- Answers --

export function useRunAnswers(projectId: string, runId: string) {
  return useQuery({
    queryKey: ["runs", projectId, runId, "answers"],
    queryFn: () =>
      apiGet<PaginatedResponse<Answer>>(
        `/projects/${projectId}/runs/${runId}/answers`
      ),
    enabled: !!projectId && !!runId,
  });
}
