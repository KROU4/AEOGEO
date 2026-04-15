/** Matches `app.schemas.project_explorer.ProjectSovResponse`. */
export interface SovBrandEntry {
  domain: string;
  sov_pct: number;
  is_client: boolean;
}

export interface ProjectSovResponse {
  brands: SovBrandEntry[];
  total_tracked_brands: number;
  updated_at: string;
}
