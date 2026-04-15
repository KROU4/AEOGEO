/** Matches `app.schemas.project_explorer.ProjectTrendsResponse`. */
export interface ProjectTrendsResponse {
  labels: string[];
  series: {
    sov: number[];
    visibility: number[];
  };
  updated_at: string;
}
