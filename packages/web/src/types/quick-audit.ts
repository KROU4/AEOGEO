/** Matches `geo_audit.models.QuickAuditResult` + `audit_id` from API. */
export interface QuickAuditResult {
  audit_id: string;
  overall_geo_score: number;
  citability_score: number;
  ai_crawler_access: Record<string, boolean>;
  has_llms_txt: boolean;
  schema_org: Record<string, unknown>;
  top_issues: string[];
  top_recommendations: string[];
}
