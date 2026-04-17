import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import type { LatestRunStatus } from "@/types/latest-run";
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

/** Most recent run (any status) — status bar / polling while active. */
export function useLatestRun(projectId: string | undefined) {
  return useQuery({
    queryKey: ["runs", projectId, "latest"],
    queryFn: () =>
      apiGet<LatestRunStatus>(`/projects/${projectId}/runs/latest`),
    enabled: !!projectId,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === "pending" || s === "running") return 4000;
      return false;
    },
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
      queryClient.invalidateQueries({ queryKey: ["runs", projectId, "latest"] });
      queryClient.invalidateQueries({ queryKey: ["project-trends", projectId] });
    },
  });
}

export function useQuickStartRun(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<EngineRun>(`/projects/${projectId}/runs/quick-start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["runs", projectId, "latest"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-dashboard", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-trends", projectId] });
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
      queryClient.invalidateQueries({ queryKey: ["runs", projectId, "latest"] });
      queryClient.invalidateQueries({ queryKey: ["project-trends", projectId] });
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
      queryClient.invalidateQueries({ queryKey: ["runs", projectId, "latest"] });
      queryClient.invalidateQueries({ queryKey: ["project-trends", projectId] });
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
