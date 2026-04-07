import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api-client";
import type {
  TenantUsageOverview,
  TenantUsageDetail,
  TenantQuota,
  TenantQuotaUpdate,
} from "@/types/admin";

export function useAdminTenantsUsage() {
  return useQuery({
    queryKey: ["admin", "ai-usage", "tenants"],
    queryFn: () =>
      apiGet<TenantUsageOverview[]>("/admin/ai-usage/tenants"),
  });
}

export function useAdminTenantUsage(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "ai-usage", "tenants", tenantId],
    queryFn: () =>
      apiGet<TenantUsageDetail>(`/admin/ai-usage/tenants/${tenantId}`),
    enabled: !!tenantId,
  });
}

export function useAdminTenantQuota(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "ai-usage", "tenants", tenantId, "quota"],
    queryFn: () =>
      apiGet<TenantQuota>(`/admin/ai-usage/tenants/${tenantId}/quota`),
    enabled: !!tenantId,
  });
}

export function useUpdateAdminTenantQuota(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TenantQuotaUpdate) =>
      apiPut<TenantQuota>(
        `/admin/ai-usage/tenants/${tenantId}/quota`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "ai-usage", "tenants", tenantId],
      });
    },
  });
}
