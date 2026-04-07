import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type { AIProviderKey, AIProviderKeyCreate, KeyTestResult } from "@/types/admin";

export function useAdminKeys() {
  return useQuery({
    queryKey: ["admin", "ai-keys"],
    queryFn: () => apiGet<AIProviderKey[]>("/admin/ai-keys/"),
  });
}

export function useCreateAdminKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AIProviderKeyCreate) =>
      apiPost<AIProviderKey>("/admin/ai-keys/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-keys"] });
    },
  });
}

export function useRotateAdminKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keyId, newApiKey }: { keyId: string; newApiKey: string }) =>
      apiPut<AIProviderKey>(`/admin/ai-keys/${keyId}/rotate`, {
        new_api_key: newApiKey,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-keys"] });
    },
  });
}

export function useRevokeAdminKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => apiDelete(`/admin/ai-keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-keys"] });
    },
  });
}

export function useTestAdminKey() {
  return useMutation({
    mutationFn: (keyId: string) =>
      apiPost<KeyTestResult>(`/admin/ai-keys/${keyId}/test`),
  });
}
