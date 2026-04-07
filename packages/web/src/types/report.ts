import type { ReportCreate, ShareLink } from "./api";

export type { ReportCreate, ShareLink };

export type ReportType =
  | "visibility_audit"
  | "competitive_analysis"
  | "content_performance";

export interface ReportRunSummary {
  score_count: number;
  avg_total: number;
  avg_mention: number;
  avg_sentiment: number;
  avg_position: number;
  avg_accuracy: number;
  avg_citation: number;
  avg_recommendation: number;
  min_total: number;
  max_total: number;
}

export interface ReportEngineBreakdown {
  engine_id: string;
  engine_name: string | null;
  score_count: number;
  avg_total: number;
  avg_mention: number;
  avg_sentiment: number;
  avg_position: number;
  avg_accuracy: number;
  avg_citation: number;
  avg_recommendation: number;
}

export interface ReportTopGap {
  dimension: string;
  avg_score: number;
}

export interface EntityMentionSummary {
  name: string;
  total_mentions: number;
  sentiment_breakdown: Record<string, number>;
  avg_position?: number | null;
}

export interface CompetitivePositioningEntry {
  name: string;
  mention_rate_pct: number;
  sentiment_breakdown: Record<string, number>;
}

export interface ReportContentItem {
  id: string;
  title: string;
  content_type: string;
  published_at: string | null;
}

export interface VisibilityAuditData {
  report_type: "visibility_audit";
  generated_at: string;
  run_id: string | null;
  summary: ReportRunSummary | { message: string };
  by_engine: ReportEngineBreakdown[];
  top_gaps: ReportTopGap[];
  competitor_mentions: EntityMentionSummary[];
}

export interface CompetitiveAnalysisData {
  report_type: "competitive_analysis";
  generated_at: string;
  run_id: string | null;
  brand_mentions: EntityMentionSummary;
  competitor_analysis: EntityMentionSummary[];
  positioning: {
    message?: string;
    total_answers?: number;
    brand_mention_rate_pct?: number;
    competitors?: CompetitivePositioningEntry[];
  };
}

export interface ContentPerformanceData {
  report_type: "content_performance";
  generated_at: string;
  published_content_count: number;
  content_items: ReportContentItem[];
  score_proxy: ReportEngineBreakdown[];
}

export type ReportPayload =
  | VisibilityAuditData
  | CompetitiveAnalysisData
  | ContentPerformanceData
  | Record<string, unknown>;

export interface ReportSummary {
  id: string;
  title: string;
  report_type: ReportType;
  project_id: string;
  created_at: string;
  shareable_url: string | null;
}

export interface Report extends ReportSummary {
  data: ReportPayload | null;
}

export interface PublicReport {
  title: string;
  report_type: ReportType;
  created_at: string;
  data: ReportPayload | null;
}
