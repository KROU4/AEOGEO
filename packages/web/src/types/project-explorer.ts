/** Mirrors backend explorer responses (subset used by the web app). */

export interface CitationRow {
  domain: string;
  engine: string;
  times_cited: number;
  is_client_domain: boolean;
  first_seen: string | null;
  query_preview: string | null;
  trend: number[];
}

export interface CitationsListResponse {
  total: number;
  citations: CitationRow[];
  updated_at: string;
}

export interface CitationQueryDetail {
  query: string;
  engine: string;
  ai_response_excerpt: string;
  cited_at: string | null;
}

export interface CitationDomainDetailResponse {
  domain: string;
  all_queries: CitationQueryDetail[];
}

export interface CompetitorComparisonBrand {
  domain: string;
  is_client: boolean;
  overall_sov: number;
  by_platform: Record<string, { sov: number; rank: number }>;
  trend: number[];
}

export interface CompetitorsComparisonResponse {
  brands: CompetitorComparisonBrand[];
  updated_at: string;
  period: string;
}

export interface CompetitorsInsightResponse {
  insight: string;
}

export interface PlatformQueryRow {
  query_text: string;
  rank: number;
  brand_mentioned: boolean;
  mention_position: number | null;
  citation_count: number;
  answer_id: string;
}

export interface PlatformQueriesResponse {
  engine: string;
  queries: PlatformQueryRow[];
  total: number;
}
