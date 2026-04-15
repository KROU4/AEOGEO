/** Matches `app.schemas.project_dashboard_contract.ProjectDashboardResponse`. */
export interface ProjectDashboardResponse {
  period: string;
  overall_score: number;
  overall_score_delta: number;
  share_of_voice: number;
  share_of_voice_delta: number;
  avg_rank: number;
  avg_rank_delta: number;
  citation_rate: number;
  citation_rate_delta: number;
  sparklines: Record<string, number[]>;
  updated_at: string;
}
