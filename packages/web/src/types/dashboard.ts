export type {
  DashboardVisibilityScore as VisibilityScore,
  ShareOfVoiceEntry,
  SentimentBreakdown,
  CitationRate,
  ActivityItem,
} from "./api";

// UI-facing score cards use a flattened shape derived from scoring endpoints.
export interface ScoreSummary {
  total_score: number;
  mention_score: number;
  sentiment_score: number;
  position_score: number;
  accuracy_score: number;
  citation_score: number;
  recommendation_score: number;
  trend: number | null;
  run_id: string | null;
}

export interface EngineScore {
  engine_id: string;
  engine: string;
  score_count: number;
  total_score: number;
  mention_score: number;
  sentiment_score: number;
  position_score: number;
  accuracy_score: number;
  citation_score: number;
  recommendation_score: number;
}

export interface ScoreTrendPoint {
  run_id: string;
  date: string;
  score_count: number;
  total_score: number;
}
