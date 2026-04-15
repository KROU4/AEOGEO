import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  AIProviderKey,
  AIProviderKeyCreate,
  KeyTestResult,
} from "@/types/admin";

export function useTenantAiKeys() {
  return useQuery({
    queryKey: ["ai-keys", "tenant"],
    queryFn: () => apiGet<AIProviderKey[]>("/ai-keys/"),
  });
}

export function useCreateTenantAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AIProviderKeyCreate) =>
      apiPost<AIProviderKey>("/ai-keys/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-keys", "tenant"] });
    },
  });
}

export function useRotateTenantAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keyId, newApiKey }: { keyId: string; newApiKey: string }) =>
      apiPut<AIProviderKey>(`/ai-keys/${keyId}/rotate`, {
        new_api_key: newApiKey,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-keys", "tenant"] });
    },
  });
}

export function useRevokeTenantAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => apiDelete(`/ai-keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-keys", "tenant"] });
    },
  });
}

export function useTestTenantAiKey() {
  return useMutation({
    mutationFn: (keyId: string) =>
      apiPost<KeyTestResult>(`/ai-keys/${keyId}/test`),
  });
}
