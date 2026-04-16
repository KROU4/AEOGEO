/** Matches `geo_audit.models.QuickAuditResult` + `audit_id` from API. */
export interface InfrastructureCheck {
  key: string;
  label: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface QuickAuditResult {
  audit_id: string;
  overall_geo_score: number;
  citability_score: number;
  ai_crawler_access: Record<string, boolean>;
  has_llms_txt: boolean;
  has_sitemap: boolean;
  sitemap_url_count: number;
  robots_txt_status: string;
  llms_txt_status: string;
  infrastructure_checks: InfrastructureCheck[];
  readiness_label: string;
  schema_org: Record<string, unknown>;
  top_issues: string[];
  top_recommendations: string[];
}
