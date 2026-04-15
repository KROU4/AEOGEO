import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export interface BillingQuota {
  tokens_used: number;
  tokens_limit: number | null;
  tokens_pct: number | null;
  cost_used: number;
  cost_limit: number | null;
  cost_pct: number | null;
  requests_today: number;
  requests_day_limit: number | null;
  requests_this_month: number;
  warning_threshold_pct: number;
  warning_active: boolean;
  limit_reached: boolean;
}

export interface BillingPlanResponse {
  plan: string;
  quota: BillingQuota;
}

export function useBillingPlan() {
  return useQuery({
    queryKey: ["billing", "plan"],
    queryFn: () => apiGet<BillingPlanResponse>("/billing/plan"),
  });
}
