import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import type {
  ScheduledRun,
  ScheduledRunCreate,
  ScheduledRunUpdate,
} from "@/types/schedule";

export function useSchedules(projectId: string) {
  return useQuery({
    queryKey: ["schedules", projectId],
    queryFn: () =>
      apiGet<ScheduledRun[]>(`/projects/${projectId}/schedules`),
    enabled: !!projectId,
  });
}

export function useCreateSchedule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScheduledRunCreate) =>
      apiPost<ScheduledRun>(`/projects/${projectId}/schedules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules", projectId] });
    },
  });
}

export function useUpdateSchedule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      data,
    }: {
      scheduleId: string;
      data: ScheduledRunUpdate;
    }) =>
      apiPut<ScheduledRun>(
        `/projects/${projectId}/schedules/${scheduleId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules", projectId] });
    },
  });
}

export function useDeleteSchedule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      apiDelete<void>(`/projects/${projectId}/schedules/${scheduleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules", projectId] });
    },
  });
}
