import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type {
  UsageSummary,
  QuotaStatus,
  UsageBreakdown,
  TimeseriesPoint,
} from "@/types/admin";

export function useUsageSummary() {
  return useQuery({
    queryKey: ["usage", "summary"],
    queryFn: () => apiGet<UsageSummary>("/usage/summary"),
  });
}

export function useQuotaStatus() {
  return useQuery({
    queryKey: ["usage", "quota-status"],
    queryFn: () => apiGet<QuotaStatus>("/usage/quota-status"),
  });
}

export function useUsageBreakdown() {
  return useQuery({
    queryKey: ["usage", "breakdown"],
    queryFn: () => apiGet<UsageBreakdown>("/usage/breakdown"),
  });
}

export function useUsageTimeseries() {
  return useQuery({
    queryKey: ["usage", "timeseries"],
    queryFn: () => apiGet<TimeseriesPoint[]>("/usage/timeseries"),
  });
}
