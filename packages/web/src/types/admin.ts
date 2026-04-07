export type {
  AIProviderKey,
  AIProviderKeyCreate,
  AIProviderKeyRotate,
  UsageSummary,
  QuotaStatus,
  ProviderUsage,
  ModelUsage,
  TimeseriesPoint,
  UsageBreakdown,
  TenantUsageOverview,
  TenantUsageDetail,
  TenantQuota,
  TenantQuotaUpdate,
} from "./api";

// The admin key test endpoint does not declare a response model yet.
export interface KeyTestResult {
  success: boolean;
  error?: string;
}
