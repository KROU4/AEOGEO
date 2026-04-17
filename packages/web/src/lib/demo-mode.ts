/** Stakeholder demos only: relax dashboard gates (see CLAUDE.md). Remove for production. */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}
