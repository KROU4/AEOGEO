import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import type {
  Content,
  ContentCreate,
  ContentGenerateFromTemplate,
  ContentTemplate,
  ContentUpdate,
} from "@/types/content";
import type { PaginatedResponse } from "@/types/api";

export function useContentList(status?: string, projectId?: string) {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  if (projectId) {
    params.set("project_id", projectId);
  }

  return useQuery({
    queryKey: ["content", { status, projectId }],
    queryFn: () =>
      apiGet<PaginatedResponse<Content>>(
        `/content/${params.toString() ? `?${params}` : ""}`
      ),
  });
}

export function useContent(id: string) {
  return useQuery({
    queryKey: ["content", id],
    queryFn: () => apiGet<Content>(`/content/${id}`),
    enabled: !!id,
  });
}

export function useCreateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ContentCreate) => apiPost<Content>("/content/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContentUpdate }) =>
      apiPut<Content>(`/content/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useSubmitForReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<Content>(`/content/${id}/submit-review`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useApproveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Content>(`/content/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useRejectContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Content>(`/content/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useArchiveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Content>(`/content/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function useContentTemplates() {
  return useQuery({
    queryKey: ["content-templates"],
    queryFn: () => apiGet<ContentTemplate[]>("/content-templates/"),
  });
}

export function useGenerateFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      request,
    }: {
      projectId: string;
      request: ContentGenerateFromTemplate;
    }) =>
      apiPost<Content>(`/projects/${projectId}/content/generate`, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
}
