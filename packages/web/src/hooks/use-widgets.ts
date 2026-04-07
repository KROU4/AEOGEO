import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  Widget,
  WidgetCreate,
  WidgetUpdate,
  EmbedCode,
  WidgetAnalytics,
} from "@/types/widget";

export function useWidgets(projectId?: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);

  return useQuery({
    queryKey: ["widgets", { projectId }],
    queryFn: () =>
      apiGet<Widget[]>(
        `/widgets/${params.toString() ? `?${params}` : ""}`
      ),
  });
}

export function useWidget(id: string) {
  return useQuery({
    queryKey: ["widgets", id],
    queryFn: () => apiGet<Widget>(`/widgets/${id}`),
    enabled: !!id,
  });
}

export function useCreateWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WidgetCreate) =>
      apiPost<Widget>("/widgets/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });
}

export function useUpdateWidget(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WidgetUpdate) =>
      apiPut<Widget>(`/widgets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });
}

export function useDeleteWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/widgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });
}

export function useEmbedCode(widgetId: string) {
  return useQuery({
    queryKey: ["widgets", widgetId, "embed-code"],
    queryFn: () => apiGet<EmbedCode>(`/widgets/${widgetId}/embed-code`),
    enabled: !!widgetId,
  });
}

export function useWidgetAnalytics(widgetId: string) {
  return useQuery({
    queryKey: ["widgets", widgetId, "analytics"],
    queryFn: () => apiGet<WidgetAnalytics>(`/widgets/${widgetId}/analytics`),
    enabled: !!widgetId,
  });
}
