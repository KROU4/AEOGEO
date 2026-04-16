import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  recommendation?: string | null;
}

export interface TechnicalAuditResult {
  score: number;
  is_https: boolean;
  ttfb_ms: number | null;
  has_sitemap: boolean;
  sitemap_url_count: number;
  has_robots_txt: boolean;
  ai_crawler_access: Record<string, string>;
  has_llmstxt: boolean;
  has_meta_robots_noindex: boolean;
  has_canonical: boolean;
  has_og_tags: boolean;
  has_mobile_viewport: boolean;
  x_robots_tag: string | null;
  score_crawlability: number;
  score_indexability: number;
  score_security: number;
  score_mobile: number;
  score_performance: number;
  score_ssr: number;
  issues: AuditIssue[];
}

export interface SchemaAuditResult {
  score: number;
  schema_types: string[];
  has_organization: boolean;
  has_website: boolean;
  has_search_action: boolean;
  has_breadcrumbs: boolean;
  has_speakable: boolean;
  same_as_count: number;
  is_server_rendered: boolean;
  schema_objects: Record<string, unknown>[];
  issues: AuditIssue[];
}

export interface LlmsTxtResult {
  score: number;
  has_llmstxt: boolean;
  has_llmstxt_full: boolean;
  llmstxt_url: string | null;
  section_count: number;
  link_count: number;
  valid_links: number;
  score_completeness: number;
  score_accuracy: number;
  score_usefulness: number;
  issues: AuditIssue[];
  generated_template?: string | null;
}

export interface ContentQualityResult {
  score: number;
  word_count: number;
  heading_depth: number;
  paragraph_count: number;
  avg_sentence_length: number;
  statistical_density: number;
  has_author: boolean;
  has_publish_date: boolean;
  external_link_count: number;
  internal_link_count: number;
  score_experience: number;
  score_expertise: number;
  score_authoritativeness: number;
  score_trustworthiness: number;
  topical_authority_modifier: number;
  ai_scored: boolean;
  issues: AuditIssue[];
}

export interface PlatformScores {
  google_aio: number;
  chatgpt: number;
  perplexity: number;
  gemini: number;
  copilot: number;
  average: number;
}

export interface FullSiteAuditResult {
  url: string;
  overall_geo_score: number;
  citability_score: number;
  technical: TechnicalAuditResult;
  schema: SchemaAuditResult;
  llmstxt: LlmsTxtResult;
  content: ContentQualityResult;
  platforms: PlatformScores;
  brand_authority: number;
  top_issues: AuditIssue[];
  top_recommendations: string[];
}

export type SiteAuditStatus = "pending" | "running" | "completed" | "failed";

export interface SiteAudit {
  id: string;
  project_id: string;
  url: string;
  overall_geo_score: number;
  status: SiteAuditStatus;
  error_message?: string | null;
  temporal_workflow_id?: string | null;
  /** Server anchor for “how long the audit has been running” (set when the audit is created). */
  started_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  result_json?: FullSiteAuditResult | null;
}

export interface SiteAuditListResponse {
  items: SiteAudit[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: SiteAuditStatus[] = ["pending", "running"];

/** Most recent site audit for a project (polls while running). */
export function useLatestSiteAudit(projectId: string | undefined) {
  return useQuery({
    queryKey: ["site-audit", projectId, "latest"],
    queryFn: () =>
      apiGet<SiteAudit>(`/projects/${projectId}/site-audit/latest`),
    enabled: !!projectId,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && ACTIVE_STATUSES.includes(status)) return 8000;
      return false;
    },
  });
}

/** All site audits for a project. */
export function useSiteAudits(projectId: string | undefined) {
  return useQuery({
    queryKey: ["site-audit", projectId],
    queryFn: () =>
      apiGet<SiteAuditListResponse>(`/projects/${projectId}/site-audit`),
    enabled: !!projectId,
  });
}

/** Single audit by id. */
export function useSiteAudit(
  projectId: string | undefined,
  auditId: string | undefined,
) {
  return useQuery({
    queryKey: ["site-audit", projectId, auditId],
    queryFn: () =>
      apiGet<SiteAudit>(`/projects/${projectId}/site-audit/${auditId}`),
    enabled: !!projectId && !!auditId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && ACTIVE_STATUSES.includes(status)) return 8000;
      return false;
    },
  });
}

/** Start a new site audit (POST). */
export function useStartSiteAudit(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url?: string) =>
      apiPost<SiteAudit>(`/projects/${projectId}/site-audit`, {
        url: url ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-audit", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["site-audit", projectId, "latest"],
      });
    },
  });
}
