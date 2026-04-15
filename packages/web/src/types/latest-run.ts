/** Matches `app.schemas.engine_run.LatestRunStatusResponse`. */
export interface LatestRunStatus {
  run_id: string;
  status: string;
  completed_at: string | null;
  stages: Record<string, string>;
  progress_pct: number;
  updated_at: string;
}
