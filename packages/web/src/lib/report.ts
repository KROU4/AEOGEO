export function buildAbsoluteShareUrl(
  path: string,
  origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
): string {
  return new URL(path, origin).toString();
}

export function formatVisibilityScore(score: number): string {
  return score.toFixed(1);
}
