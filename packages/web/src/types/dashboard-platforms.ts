/** Matches `app.schemas.project_dashboard_contract` platform payloads. */
export interface DashboardPlatformRow {
  engine: string;
  sov_pct: number;
  visibility_pct: number;
  avg_rank: number;
  run_count: number;
}

export interface DashboardPlatformsResponse {
  platforms: DashboardPlatformRow[];
}
