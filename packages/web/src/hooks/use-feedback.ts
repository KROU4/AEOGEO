import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type {
  FeedbackCreate,
  FeedbackEntry,
  FeedbackStats,
  FeedbackEntityType,
} from "@/types/widget";

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FeedbackCreate) =>
      apiPost<FeedbackEntry>("/feedback/", data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", variables.entity_type, variables.entity_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["feedback-stats"],
      });
    },
  });
}

export function useFeedbackStats(entityType?: FeedbackEntityType) {
  const params = new URLSearchParams();
  if (entityType) params.set("entity_type", entityType);

  return useQuery({
    queryKey: ["feedback-stats", { entityType }],
    queryFn: () =>
      apiGet<FeedbackStats[]>(
        `/feedback/stats${params.toString() ? `?${params}` : ""}`
      ),
  });
}

export function useMyFeedback(entityType: FeedbackEntityType, entityId: string) {
  return useQuery({
    queryKey: ["feedback", entityType, entityId],
    queryFn: () =>
      apiGet<FeedbackEntry | null>(
        `/feedback/mine?entity_type=${entityType}&entity_id=${entityId}`
      ),
    enabled: !!entityId,
  });
}

export function useClearFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
    }: {
      entityType: FeedbackEntityType;
      entityId: string;
    }) =>
      apiDelete<void>(
        `/feedback/mine?entity_type=${entityType}&entity_id=${entityId}`,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", variables.entityType, variables.entityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["feedback-stats"],
      });
    },
  });
}
